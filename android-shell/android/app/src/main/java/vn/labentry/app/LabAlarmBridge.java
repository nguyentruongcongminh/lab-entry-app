package vn.labentry.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * Cầu nối JavaScript <-> native cho báo thức hẹn giờ của LabEntry.
 *
 * Phía web gọi window.LabAlarmNative.syncAll(json) với danh sách mẫu cần báo thức:
 *   [{"id":"<uid>", "at":<epochMs>, "label":"XN-001 — Máu ẩn"}, ...]
 * Native giữ một registry trong SharedPreferences để hủy đúng các báo thức cũ,
 * khôi phục sau khi máy khởi động lại, và biết nhãn của từng báo thức khi nó kêu.
 *
 * Dùng JavascriptInterface trực tiếp (thay vì cơ chế plugin của Capacitor) để hành vi
 * xác định tuyệt đối trên mọi trang được tải trong WebView, không phụ thuộc việc
 * đăng ký plugin phía JavaScript.
 */
public class LabAlarmBridge {
    static final String PREFS = "labentry_alarms";
    static final String KEY_IDS = "ids";
    static final String ACTION_DUE = "vn.labentry.app.ALARM_DUE";

    private final Activity activity;
    private final Context ctx;

    public LabAlarmBridge(Activity activity) {
        this.activity = activity;
        this.ctx = activity.getApplicationContext();
    }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String fKey(String id, String field) {
        return id + "|" + field;
    }

    static PendingIntent dueIntent(Context c, String id) {
        Intent intent = new Intent(c, LabAlarmReceiver.class);
        intent.setAction(ACTION_DUE);
        intent.putExtra("alarm_id", id);
        return PendingIntent.getBroadcast(c, id.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean exactAllowed(Context c) {
        /* Báo thức nay đặt bằng setAlarmClock — cơ chế báo thức người dùng,
           Android không yêu cầu quyền báo thức chính xác — nên luôn coi như đủ quyền;
           phía web sẽ không hiện hộp thoại xin quyền nữa. */
        return true;
    }

    static void scheduleOne(Context c, String id, long atMs) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = dueIntent(c, id);
        /* Đặt theo cơ chế ĐỒNG HỒ BÁO THỨC (setAlarmClock) — cùng cơ chế app Đồng hồ
           của máy: kêu đúng giờ kể cả khi app bị thu nhỏ/đóng và máy đang ngủ (Doze),
           KHÔNG cần quyền báo thức chính xác riêng, và được hệ điều hành đối xử như
           một báo thức thật. (Bản trial1/2 dùng setExactAndAllowWhileIdle +
           thông báo thường nên chuông đi qua luồng âm thanh thông báo — máy có
           thể tắt tiếng riêng luồng đó, và khi thiếu quyền exact thì giờ bị dời
           tới lúc mở lại app. Đã gặp trên máy thật của Minh 2026-11-07.) */
        Intent show = new Intent(c, MainActivity.class);
        show.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent showIntent = PendingIntent.getActivity(c, id.hashCode(), show,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setAlarmClock(new AlarmManager.AlarmClockInfo(atMs, showIntent), pi);
    }

    static void cancelOne(Context c, String id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(dueIntent(c, id));
    }

    /**
     * Đồng bộ toàn bộ: đặt/hủy để phía native khớp đúng danh sách web gửi sang.
     * Trả về "OK" | "NO_EXACT" (có mẫu cần báo nhưng chưa có quyền exact) | "ERR".
     */
    @JavascriptInterface
    public String syncAll(String json) {
        try {
            JSONArray arr = new JSONArray(json == null ? "[]" : json);
            SharedPreferences sp = prefs(ctx);
            Set<String> oldIds = new HashSet<>(sp.getStringSet(KEY_IDS, new HashSet<>()));
            Set<String> newIds = new HashSet<>();
            SharedPreferences.Editor ed = sp.edit();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                String id = o.getString("id");
                long at = o.getLong("at");
                String label = o.optString("label", id);
                newIds.add(id);
                ed.putLong(fKey(id, "at"), at);
                ed.putString(fKey(id, "label"), label);
                scheduleOne(ctx, id, at);
            }
            for (String oldId : oldIds) {
                if (!newIds.contains(oldId)) {
                    cancelOne(ctx, oldId);
                    ed.remove(fKey(oldId, "at"));
                    ed.remove(fKey(oldId, "label"));
                }
            }
            ed.putStringSet(KEY_IDS, newIds);
            ed.apply();
            if (!newIds.isEmpty() && !exactAllowed(ctx)) return "NO_EXACT";
            return "OK";
        } catch (Exception e) {
            return "ERR";
        }
    }

    @JavascriptInterface
    public boolean exactAlarmAllowed() {
        return exactAllowed(ctx);
    }

    @JavascriptInterface
    public boolean notificationsAllowed() {
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled();
    }

    @JavascriptInterface
    public void openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            activity.runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    activity.startActivity(intent);
                } catch (Exception ignored) {
                }
            });
        }
    }

    @JavascriptInterface
    public void requestNotifications() {
        if (Build.VERSION.SDK_INT >= 33) {
            activity.runOnUiThread(() -> {
                if (activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    activity.requestPermissions(
                            new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 7001);
                }
            });
        }
    }
}
