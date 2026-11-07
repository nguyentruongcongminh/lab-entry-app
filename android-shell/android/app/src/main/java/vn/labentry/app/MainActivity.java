package vn.labentry.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LabAlarmReceiver.ensureChannel(this);
        /* Gắn cầu nối báo thức native vào WebView: phía web (LabEntry v46) chỉ gọi
           window.LabAlarmNative khi tồn tại — trên trình duyệt thường không có gì thay đổi.
           Phía web tự đồng bộ lại ở nhiều thời điểm (khởi động, bấm giờ, lưu form,
           quay lại app) nên kể cả khi cầu nối gắn xong sau lúc trang bắt đầu tải,
           báo thức vẫn khớp đúng trong cùng phiên. */
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new LabAlarmBridge(this), "LabAlarmNative");
        }
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7001);
        }
    }
}
