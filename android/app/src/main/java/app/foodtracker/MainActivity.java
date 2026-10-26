package app.foodtracker;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

// Shows the web app from the APK's assets in a full-screen WebView.
public class MainActivity extends Activity {
    private static final int PICK_FILE = 1;
    private static final int SAVE_FILE = 2;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingBackup;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            // "Import backup" file picker.
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                startActivityForResult(i, PICK_FILE);
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/index.html");
    }

    // Called from app.js for "Export backup", since WebView can't download blobs.
    private class Bridge {
        @JavascriptInterface
        public void saveBackup(String json, String fileName) {
            runOnUiThread(() -> {
                pendingBackup = json;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("application/json");
                i.putExtra(Intent.EXTRA_TITLE, fileName);
                startActivityForResult(i, SAVE_FILE);
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
        if (requestCode == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(uri != null ? new Uri[] { uri } : null);
            fileCallback = null;
        } else if (requestCode == SAVE_FILE && uri != null && pendingBackup != null) {
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                out.write(pendingBackup.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this, "Backup saved", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Could not save backup", Toast.LENGTH_LONG).show();
            }
            pendingBackup = null;
        }
    }

    // Back closes an open dialog first, otherwise leaves the app.
    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return true}return false})()",
            result -> { if (!"true".equals(result)) finish(); });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }
}
