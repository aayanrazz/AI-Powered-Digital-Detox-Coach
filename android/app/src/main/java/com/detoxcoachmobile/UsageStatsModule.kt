package com.detoxcoachmobile

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import java.util.Calendar
import java.util.concurrent.ConcurrentHashMap

class UsageStatsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val USAGE_CACHE_MS = 10000L

        private val BLOCKED_PACKAGE_EXACT = setOf(
            "android",
            "com.google.android.apps.nexuslauncher",
            "com.android.launcher",
            "com.android.launcher3",
            "com.android.permissioncontroller",
            "com.google.android.permissioncontroller",
            "com.google.android.overlay.modules.permissioncontroller",
            "com.samsung.android.app.launcher",
            "com.sec.android.app.launcher",
            "com.miui.home",
            "com.oneplus.launcher",
            "com.oppo.launcher",
            "com.vivo.launcher",
            "com.realme.launcher",
            "com.huawei.android.launcher",
            "com.transsion.hilauncher"
        )

        private val BLOCKED_PACKAGE_PREFIXES = listOf(
            "com.android.systemui",
            "com.android.permissioncontroller",
            "com.google.android.permissioncontroller",
            "com.google.android.overlay.modules.permissioncontroller"
        )

        private val BLOCKED_NAME_FRAGMENTS = listOf(
            "launcher",
            "pixel launcher",
            "system ui",
            "permission controller"
        )
    }

    private val appLabelCache = ConcurrentHashMap<String, String>()
    private val categoryCache = ConcurrentHashMap<String, String>()
    private val launcherPackages by lazy { resolveLauncherPackages() }

    @Volatile
    private var lastUsageCacheAt: Long = 0L

    @Volatile
    private var lastUsageCacheRows: List<Map<String, Any>> = emptyList()

    override fun getName(): String = "UsageStatsModule"

    private fun normalizePackageName(packageName: String?): String {
        return packageName?.trim()?.lowercase() ?: ""
    }

    private fun hasUsagePermission(): Boolean {
        val appOps =
            reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager

        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName
            )
        }

        return mode == AppOpsManager.MODE_ALLOWED
    }

    @ReactMethod
    fun isUsagePermissionGranted(promise: Promise) {
        try {
            promise.resolve(hasUsagePermission())
        } catch (e: Exception) {
            promise.reject("USAGE_PERMISSION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_SETTINGS_ERROR", e.message, e)
        }
    }

    private fun resolveLauncherPackages(): Set<String> {
        val intent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            addCategory(Intent.CATEGORY_DEFAULT)
        }

        return try {
            reactContext.packageManager
                .queryIntentActivities(intent, 0)
                .mapNotNull { it.activityInfo?.packageName }
                .map { normalizePackageName(it) }
                .filter { it.isNotBlank() }
                .toSet()
        } catch (_: Exception) {
            emptySet()
        }
    }

    private fun shouldIgnoreByName(appName: String, packageName: String): Boolean {
        val lowerLabel = appName.lowercase()
        val lowerPackage = normalizePackageName(packageName)

        if (BLOCKED_NAME_FRAGMENTS.any { fragment -> lowerLabel.contains(fragment) }) {
            return true
        }

        return lowerPackage == "android" ||
            lowerPackage == reactContext.packageName.lowercase() ||
            lowerPackage in BLOCKED_PACKAGE_EXACT ||
            BLOCKED_PACKAGE_PREFIXES.any { prefix -> lowerPackage.startsWith(prefix) }
    }

    private fun isIgnoredPackage(packageName: String): Boolean {
        val normalizedPackage = normalizePackageName(packageName)

        if (normalizedPackage.isBlank()) return true
        if (normalizedPackage == reactContext.packageName.lowercase()) return true
        if (normalizedPackage in BLOCKED_PACKAGE_EXACT) return true
        if (launcherPackages.contains(normalizedPackage)) return true

        if (BLOCKED_PACKAGE_PREFIXES.any { prefix -> normalizedPackage.startsWith(prefix) }) {
            return true
        }

        val appLabel = getCachedAppLabel(packageName)
        return shouldIgnoreByName(appLabel, normalizedPackage)
    }

    private fun guessCategory(appName: String, packageName: String): String {
        val haystack = "$appName $packageName".lowercase()

        return when {
            haystack.contains("instagram") ||
                haystack.contains("facebook") ||
                haystack.contains("tiktok") ||
                haystack.contains("snapchat") ||
                haystack.contains("reddit") ||
                haystack.contains("twitter") ||
                haystack.contains("x.com") -> "Social Media"

            haystack.contains("youtube") ||
                haystack.contains("netflix") ||
                haystack.contains("spotify") ||
                haystack.contains("prime video") -> "Streaming"

            haystack.contains("classroom") ||
                haystack.contains("docs") ||
                haystack.contains("drive") ||
                haystack.contains("notion") ||
                haystack.contains("slack") ||
                haystack.contains("teams") ||
                haystack.contains("zoom") ||
                haystack.contains("gmail") ||
                haystack.contains("outlook") -> "Productivity"

            haystack.contains("game") ||
                haystack.contains("pubg") ||
                haystack.contains("freefire") ||
                haystack.contains("clash") ||
                haystack.contains("roblox") -> "Gaming"

            else -> "Other"
        }
    }

    private fun getCachedAppLabel(packageName: String): String {
        appLabelCache[packageName]?.let { return it }

        val label = try {
            val pm = reactContext.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            packageName
        }

        appLabelCache[packageName] = label
        return label
    }

    private fun getCachedCategory(appLabel: String, packageName: String): String {
        categoryCache[packageName]?.let { return it }

        val category = guessCategory(appLabel, packageName)
        categoryCache[packageName] = category
        return category
    }

    private fun toWritableArray(rows: List<Map<String, Any>>): WritableNativeArray {
        val resultArray = WritableNativeArray()

        rows.forEach { row ->
            val map = WritableNativeMap()

            map.putString("packageName", row["packageName"] as String)
            map.putString("appName", row["appName"] as String)
            map.putDouble("foregroundMs", (row["foregroundMs"] as Number).toDouble())
            map.putInt("minutesUsed", (row["minutesUsed"] as Number).toInt())
            map.putDouble("lastTimeUsed", (row["lastTimeUsed"] as Number).toDouble())
            map.putInt("pickups", (row["pickups"] as Number).toInt())
            map.putInt("unlocks", (row["unlocks"] as Number).toInt())
            map.putString("category", row["category"] as String)

            resultArray.pushMap(map)
        }

        return resultArray
    }

    @ReactMethod
    fun getTodayUsageStats(promise: Promise) {
        try {
            if (!hasUsagePermission()) {
                promise.reject("PERMISSION_DENIED", "Usage access permission is not granted.")
                return
            }

            val now = System.currentTimeMillis()

            if (lastUsageCacheRows.isNotEmpty() && now - lastUsageCacheAt < USAGE_CACHE_MS) {
                promise.resolve(toWritableArray(lastUsageCacheRows))
                return
            }

            val usageStatsManager =
                reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            val calendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            val startTime = calendar.timeInMillis
            val endTime = now

            val stats: List<UsageStats> = usageStatsManager
                .queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)
                .filter { stat ->
                    stat.totalTimeInForeground > 0 &&
                        !isIgnoredPackage(stat.packageName)
                }
                .sortedByDescending { it.totalTimeInForeground }

            val trackedPackages = stats
                .map { normalizePackageName(it.packageName) }
                .filter { it.isNotBlank() }
                .toHashSet()

            val openCounts = mutableMapOf<String, Int>()
            val interactionCounts = mutableMapOf<String, Int>()

            val usageEvents = usageStatsManager.queryEvents(startTime, endTime)
            val event = UsageEvents.Event()

            while (usageEvents.hasNextEvent()) {
                usageEvents.getNextEvent(event)

                val rawPackageName = event.packageName ?: continue
                val normalizedPackage = normalizePackageName(rawPackageName)

                if (!trackedPackages.contains(normalizedPackage)) continue

                when (event.eventType) {
                    UsageEvents.Event.MOVE_TO_FOREGROUND,
                    UsageEvents.Event.ACTIVITY_RESUMED -> {
                        openCounts[normalizedPackage] =
                            (openCounts[normalizedPackage] ?: 0) + 1
                    }

                    UsageEvents.Event.USER_INTERACTION -> {
                        interactionCounts[normalizedPackage] =
                            (interactionCounts[normalizedPackage] ?: 0) + 1
                    }
                }
            }

            val rows = stats.mapNotNull { stat ->
                if (isIgnoredPackage(stat.packageName)) {
                    null
                } else {
                    val appLabel = getCachedAppLabel(stat.packageName)
                    val category = getCachedCategory(appLabel, stat.packageName)
                    val normalizedPackage = normalizePackageName(stat.packageName)

                    val minutesUsed =
                        kotlin.math.max(
                            1,
                            ((stat.totalTimeInForeground + 59999L) / 60000L).toInt()
                        )

                    mapOf(
                        "packageName" to stat.packageName,
                        "appName" to appLabel,
                        "foregroundMs" to stat.totalTimeInForeground.toDouble(),
                        "minutesUsed" to minutesUsed,
                        "lastTimeUsed" to stat.lastTimeUsed.toDouble(),
                        "pickups" to (openCounts[normalizedPackage] ?: 0),
                        "unlocks" to (interactionCounts[normalizedPackage] ?: 0),
                        "category" to category
                    )
                }
            }

            lastUsageCacheRows = rows
            lastUsageCacheAt = now

            promise.resolve(toWritableArray(rows))
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }
}