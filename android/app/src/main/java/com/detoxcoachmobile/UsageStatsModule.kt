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
        private const val USAGE_CACHE_MS = 8000L
        private const val MAX_RESULT_ROWS = 60
        private const val OWN_APP_PACKAGE = "com.detoxcoachmobile"

        private val BLOCKED_PACKAGE_EXACT = setOf(
            "android",
            OWN_APP_PACKAGE,
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
            "com.transsion.hilauncher",
            "com.google.android.settings.intelligence",
            "com.google.android.documentsui",
            "com.android.documentsui",
            "com.android.packageinstaller",
            "com.google.android.packageinstaller"
        )

        private val BLOCKED_PACKAGE_PREFIXES = listOf(
            "com.android.systemui",
            "com.android.permissioncontroller",
            "com.google.android.permissioncontroller",
            "com.google.android.overlay.modules.permissioncontroller",
            "com.android.providers.",
            "com.google.android.overlay.modules."
        )

        private val BLOCKED_PACKAGE_FRAGMENTS = listOf(
            "settings.intelligence",
            "documentsui",
            "packageinstaller",
            "permissioncontroller"
        )

        private val BLOCKED_NAME_FRAGMENTS = listOf(
            "launcher",
            "pixel launcher",
            "system ui",
            "permission controller",
            "settings intelligence",
            "document ui",
            "documentsui",
            "package installer"
        )

        private val READABLE_TOKEN_MAP = mapOf(
            "whatsapp" to "WhatsApp",
            "youtube" to "YouTube",
            "gmail" to "Gmail",
            "instagram" to "Instagram",
            "facebook" to "Facebook",
            "messenger" to "Messenger",
            "tiktok" to "TikTok",
            "spotify" to "Spotify",
            "netflix" to "Netflix",
            "chrome" to "Chrome",
            "telegram" to "Telegram",
            "snapchat" to "Snapchat"
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
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (_: Exception) {
            promise.resolve(false)
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

    private fun buildReadableLabelFromPackage(packageName: String): String {
        val normalized = normalizePackageName(packageName)
        if (normalized.isBlank()) return "Unknown App"

        val ignoredTokens = setOf(
            "com", "org", "net", "android", "google", "apps", "app", "mobile"
        )

        val tokens = normalized
            .split(".")
            .flatMap { it.split("_", "-") }
            .map { it.trim() }
            .filter { it.isNotBlank() && !ignoredTokens.contains(it) }

        val meaningfulTokens = if (tokens.size >= 2) tokens.takeLast(2) else tokens

        return meaningfulTokens
            .joinToString(" ") { token ->
                READABLE_TOKEN_MAP[token] ?: token.replaceFirstChar { ch ->
                    if (ch.isLowerCase()) ch.titlecase() else ch.toString()
                }
            }
            .ifBlank { packageName }
    }

    private fun normalizeLabel(appLabel: String, packageName: String): String {
        val raw = appLabel.trim()

        if (raw.isBlank()) {
            return buildReadableLabelFromPackage(packageName)
        }

        return if (raw.equals(packageName, ignoreCase = true)) {
            buildReadableLabelFromPackage(packageName)
        } else {
            raw
        }
    }

    private fun getCachedAppLabel(packageName: String): String {
        appLabelCache[packageName]?.let { return it }

        val label = try {
            val pm = reactContext.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            val resolved = pm.getApplicationLabel(appInfo).toString()
            normalizeLabel(resolved, packageName)
        } catch (_: Exception) {
            buildReadableLabelFromPackage(packageName)
        }

        appLabelCache[packageName] = label
        return label
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
            BLOCKED_PACKAGE_PREFIXES.any { prefix -> lowerPackage.startsWith(prefix) } ||
            BLOCKED_PACKAGE_FRAGMENTS.any { fragment -> lowerPackage.contains(fragment) }
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

        if (BLOCKED_PACKAGE_FRAGMENTS.any { fragment -> normalizedPackage.contains(fragment) }) {
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
                haystack.contains("x.com") ||
                haystack.contains("whatsapp") ||
                haystack.contains("messenger") -> "Social Media"

            haystack.contains("youtube") ||
                haystack.contains("netflix") ||
                haystack.contains("spotify") ||
                haystack.contains("music") ||
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
                promise.resolve(WritableNativeArray())
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

            val rawStats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime,
                endTime
            ) ?: emptyList()

            val stats: List<UsageStats> = rawStats
                .asSequence()
                .filter { it.totalTimeInForeground > 0 }
                .filter { !isIgnoredPackage(it.packageName) }
                .sortedByDescending { it.totalTimeInForeground }
                .take(MAX_RESULT_ROWS)
                .toList()

            val trackedPackages = stats
                .map { normalizePackageName(it.packageName) }
                .filter { it.isNotBlank() }
                .toHashSet()

            val openCounts = mutableMapOf<String, Int>()
            val interactionCounts = mutableMapOf<String, Int>()

            try {
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
            } catch (_: Exception) {
            }

            val rows = stats.map { stat ->
                val appLabel = getCachedAppLabel(stat.packageName)
                val normalizedPackage = normalizePackageName(stat.packageName)

                mapOf(
                    "packageName" to stat.packageName,
                    "appName" to appLabel,
                    "foregroundMs" to stat.totalTimeInForeground.toDouble(),
                    "minutesUsed" to kotlin.math.max(
                        1,
                        ((stat.totalTimeInForeground + 59999L) / 60000L).toInt()
                    ),
                    "lastTimeUsed" to stat.lastTimeUsed.toDouble(),
                    "pickups" to (openCounts[normalizedPackage] ?: 0),
                    "unlocks" to (interactionCounts[normalizedPackage] ?: 0),
                    "category" to getCachedCategory(appLabel, stat.packageName)
                )
            }

            lastUsageCacheRows = rows
            lastUsageCacheAt = now

            promise.resolve(toWritableArray(rows))
        } catch (_: Exception) {
            promise.resolve(WritableNativeArray())
        }
    }
}