package vn.labentry.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.util.HashSet;
import java.util.Set;

/**
 * Nhận sự kiện báo thức tới giờ (và BOOT_COMPLETED để khôi phục báo thức sau reboot):
 * hiện thông báo hệ thống ưu tiên cao — âm thanh + rung — chạm vào thì mở LabEntry.
 */
public class LabAlarmReceiver extends BroadcastReceiver {
    static final String CHANNEL_ID = "labentry_due_alarm";

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Mẫu tới giờ nhập kết quả", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Báo đúng giờ hẹn nhập kết quả của các xét nghiệm hẹn giờ");
            /* Âm thanh dùng NHẠC BÁO THỨC của máy qua luồng âm thanh BÁO THỨC
               (USAGE_ALARM) — độc lập với âm lượng thông báo thường, để máy đang
               tắt tiếng thông báo vẫn kêu như đồng hồ báo thức. Kênh mới
               (labentry_due_alarm) vì kênh Android không sửa được sau khi đã tạo. */
            android.net.Uri alarmSound = android.media.RingtoneManager.getDefaultUri(
                    android.media.RingtoneManager.TYPE_ALARM);
            android.media.AudioAttributes alarmAttrs = new android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            ch.setSound(alarmSound, alarmAttrs);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        SharedPreferences sp = LabAlarmBridge.prefs(context);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            /* Máy vừa khởi động lại: đặt lại mọi báo thức còn trong tương lai từ registry */
            long now = System.currentTimeMillis();
            Set<String> ids = new HashSet<>(sp.getStringSet(LabAlarmBridge.KEY_IDS, new HashSet<>()));
            for (String id : ids) {
                long at = sp.getLong(id + "|at", 0);
                if (at > now) LabAlarmBridge.scheduleOne(context, id, at);
            }
            return;
        }

        String id = intent == null ? null : intent.getStringExtra("alarm_id");
        if (id == null) return;
        String label = sp.getString(id + "|label", id);

        /* Dọn registry: báo thức này đã kêu */
        Set<String> ids = new HashSet<>(sp.getStringSet(LabAlarmBridge.KEY_IDS, new HashSet<>()));
        ids.remove(id);
        sp.edit().putStringSet(LabAlarmBridge.KEY_IDS, ids)
                .remove(id + "|at").remove(id + "|label").apply();

        ensureChannel(context);
        Intent open = new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(context, id.hashCode(), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Tới giờ nhập kết quả")
                .setContentText(label)
                .setStyle(new NotificationCompat.BigTextStyle()
                        .bigText(label + " — mở LabEntry để nhập kết quả."))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setContentIntent(content)
                .setFullScreenIntent(content, true)
                .setAutoCancel(true)
                .setVibrate(new long[]{0, 500, 200, 500, 200, 500})
                .build();
        /* Kêu lặp lại liên tục cho tới khi người dùng chạm vào thông báo —
           đúng tính chất một báo thức tới giờ, không chỉ bíp một lần. */
        notification.flags |= Notification.FLAG_INSISTENT;
        try {
            NotificationManagerCompat.from(context).notify(id.hashCode(), notification);
        } catch (SecurityException ignored) {
            /* Chưa có quyền thông báo: bỏ qua lặng lẽ, banner trong app vẫn là đường dự phòng */
        }
    }
}
