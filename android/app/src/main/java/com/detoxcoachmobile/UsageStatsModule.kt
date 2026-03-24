package com.detoxcoachmobile

import android.app.AppOpsManager
import android.app.usage.UsageEvents
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

class UsageStatsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageStatsModule"

    @ReactMethod
    fun isUsagePermissionGranted(promise: Promise) {
        try {
            val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
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

            promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
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

    private fun isIgnoredPackage(packageName: String): Boolean {
        return packageName == reactContext.packageName ||
            packageName == "android" ||
            packageName.startsWith("com.android.systemui")
    }

    private fun guessCategory(appName: String, packageName: String): String {
        val haystack = "$appName $packageName".lowercase()

        return when {
            haystack.contains("instagram") ||
                haystack.contains("facebook") ||
                haystack.contains("tiktok") ||
                haystack.contains("snapchat") ||
                haystack.contains("reddit") ||
                haystack.contains("twitter") -> "Social Media"

            haystack.contains("youtube") ||
                haystack.contains("netflix") ||
                haystack.contains("spotify") -> "Streaming"

            haystack.contains("classroom") ||
                haystack.contains("docs") ||
                haystack.contains("drive") ||
                haystack.contains("notion") ||
                haystack.contains("slack") ||
                haystack.contains("teams") ||
                haystack.contains("zoom") -> "Productivity"

            haystack.contains("game") ||
                haystack.contains("pubg") ||
                haystack.contains("freefire") ||
                haystack.contains("clash") -> "Gaming"

            else -> "Other"
        }
    }

    @ReactMethod
    fun getTodayUsageStats(promise: Promise) {
        try {
            val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
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

            if (mode != AppOpsManager.MODE_ALLOWED) {
                promise.reject("PERMISSION_DENIED", "Usage access permission is not granted.")
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
            val endTime = System.currentTimeMillis()

            val openCounts = mutableMapOf<String, Int>()
            val interactionCounts = mutableMapOf<String, Int>()

            val usageEvents = usageStatsManager.queryEvents(startTime, endTime)
            val event = UsageEvents.Event()

            while (usageEvents.hasNextEvent()) {
                usageEvents.getNextEvent(event)
                val packageName = event.packageName ?: continue

                if (isIgnoredPackage(packageName)) continue

                when (event.eventType) {
                    UsageEvents.Event.MOVE_TO_FOREGROUND,
                    UsageEvents.Event.ACTIVITY_RESUMED -> {
                        openCounts[packageName] = (openCounts[packageName] ?: 0) + 1
                    }

                    UsageEvents.Event.USER_INTERACTION -> {
                        interactionCounts[packageName] = (interactionCounts[packageName] ?: 0) + 1
                    }
                }
            }

            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime,
                endTime
            )

            val pm = reactContext.packageManager
            val resultArray = WritableNativeArray()

            stats
                .filter { stat ->
                    stat.totalTimeInForeground > 0 && !isIgnoredPackage(stat.packageName)
                }
                .sortedByDescending { it.totalTimeInForeground }
                .forEach { stat ->
                    val map = WritableNativeMap()

                    val appLabel = try {
                        val appInfo = pm.getApplicationInfo(stat.packageName, 0)
                        pm.getApplicationLabel(appInfo).toString()
                    } catch (e: Exception) {
                        stat.packageName
                    }

                    val minutesUsed =
                        kotlin.math.max(1, ((stat.totalTimeInForeground + 59999L) / 60000L).toInt())

                    map.putString("packageName", stat.packageName)
                    map.putString("appName", appLabel)
                    map.putDouble("foregroundMs", stat.totalTimeInForeground.toDouble())
                    map.putInt("minutesUsed", minutesUsed)
                    map.putDouble("lastTimeUsed", stat.lastTimeUsed.toDouble())
                    map.putInt("pickups", openCounts[stat.packageName] ?: 0)
                    map.putInt("unlocks", interactionCounts[stat.packageName] ?: 0)
                    map.putString("category", guessCategory(appLabel, stat.packageName))

                    resultArray.pushMap(map)
                }

            promise.resolve(resultArray)
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }
}