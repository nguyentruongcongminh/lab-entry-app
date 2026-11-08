package vn.labentry.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/* Cầu nối ghi file cho phía web (LabEntry v52, F28).
 *
 * WebView không tự xử lý việc tải file blob (<a download>), nên trong các bản
 * APK tới trial3, nút xuất sao lưu / xuất CSV / nhắc Lịch đều báo thành công
 * mà không ghi được file nào. saveFile ghi thẳng vào thư mục Tải xuống công
 * cộng của máy: Android 10+ qua MediaStore (không cần quyền), Android cũ hơn
 * ghi trực tiếp (cần WRITE_EXTERNAL_STORAGE, đã khai báo với maxSdkVersion 28
 * trong AndroidManifest). Trả "OK" | "ERR" để phía web chỉ báo thành công khi
 * file thật sự đã được ghi. */
public class LabFileBridge {
    private final Context ctx;

    public LabFileBridge(Context ctx) {
        this.ctx = ctx.getApplicationContext();
    }

    @JavascriptInterface
    public String saveFile(String name, String content) {
        try {
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
}
