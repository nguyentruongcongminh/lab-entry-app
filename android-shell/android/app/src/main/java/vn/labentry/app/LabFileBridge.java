package vn.labentry.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/* Cầu nối file + in cho phía web (LabEntry v52 F28, v53 F29).
 *
 * WebView không tự xử lý việc tải file blob (<a download>) và window.print()
 * là hàm rỗng trong WebView, nên trong các bản APK đầu, nút xuất sao lưu /
 * xuất CSV / nhắc Lịch báo thành công mà không ghi được file nào, còn nút
 * Xuất PDF / In thì bấm không hiện gì.
 *
 * saveFile: ghi thẳng vào thư mục Tải xuống công cộng — Android 10+ qua
 * MediaStore (không cần quyền), Android cũ hơn ghi trực tiếp (cần
 * WRITE_EXTERNAL_STORAGE, đã khai báo với maxSdkVersion 28). Trả "OK"|"ERR"
 * để phía web chỉ báo thành công khi file thật sự đã được ghi.
 *
 * print: mở hộp thoại in hệ thống của Android (PrintManager + adapter in của
 * WebView) cho trang hiện tại — có cả tuỳ chọn "Lưu thành PDF". Phía web đã
 * dựng sẵn nội dung in vào #print-area trước khi gọi; CSS @media print lo
 * phần chỉ hiện tờ in. */
public class LabFileBridge {
    private final Activity activity;

    public LabFileBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String saveFile(String name, String content) {
        try {
            Context ctx = activity.getApplicationContext();
            byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            String mime = name.endsWith(".json") ? "application/json"
                    : name.endsWith(".csv") ? "text/csv"
                    : name.endsWith(".ics") ? "text/calendar" : "text/plain";
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                ContentResolver resolver = ctx.getContentResolver();
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return "ERR";
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) return "ERR";
                    out.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                return "OK";
            }
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) return "ERR";
            if (!dir.exists() && !dir.mkdirs()) return "ERR";
            try (FileOutputStream out = new FileOutputStream(new File(dir, name))) {
                out.write(bytes);
            }
            return "OK";
        } catch (Exception e) {
            return "ERR";
        }
    }

    @JavascriptInterface
    public void print() {
        activity.runOnUiThread(() -> {
            try {
                WebView webView = (activity instanceof BridgeActivity)
                        ? ((BridgeActivity) activity).getBridge().getWebView() : null;
                if (webView == null) return;
                PrintManager pm = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                if (pm == null) return;
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("LabEntry");
                pm.print("LabEntry", adapter, new PrintAttributes.Builder().build());
            } catch (Exception ignored) {
                /* Không in được thì thôi — phía web không có kênh báo lỗi đồng bộ */
            }
        });
    }
}
