package com.khanhnguyen130804.miniphotoeditor;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

@CapacitorPlugin(
    name = "GallerySave",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class GallerySavePlugin extends Plugin {

    private static final int MAX_CHUNK_BYTES = 256 * 1024;
    private static final int MAX_BASE64_CHUNK_LENGTH = ((MAX_CHUNK_BYTES + 2) / 3) * 4;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Map<String, SaveSession> sessions = new HashMap<>();

    @PluginMethod
    public void beginSave(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionResult");
            return;
        }
        beginSaveOnIo(call);
    }

    @PermissionCallback
    private void storagePermissionResult(PluginCall call) {
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("Cần quyền lưu trữ để ghi ảnh vào thư viện trên Android 7–9.");
            return;
        }
        beginSaveOnIo(call);
    }

    private void beginSaveOnIo(PluginCall call) {
        enqueue(call, "Không thể chuẩn bị lưu ảnh", () -> {
            String filename = safeFilename(call.getString("filename"), call.getString("mimeType"));
            String mimeType = call.getString("mimeType");
            Long expectedBytes = call.getLong("size");
            if (expectedBytes == null || expectedBytes <= 0) throw new IOException("Kích thước ảnh không hợp lệ.");

            String saveId = UUID.randomUUID().toString();
            SaveSession session = createSession(saveId, filename, mimeType, expectedBytes);
            sessions.put(saveId, session);

            JSObject result = new JSObject();
            result.put("saveId", saveId);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void writeChunk(PluginCall call) {
        enqueue(call, "Không thể ghi dữ liệu ảnh", () -> {
            String saveId = call.getString("saveId");
            String encoded = call.getString("data");
            SaveSession session = sessions.get(saveId);
            if (session == null) throw new IOException("Phiên lưu ảnh không còn hoạt động.");
            if (encoded == null || encoded.isEmpty() || encoded.length() > MAX_BASE64_CHUNK_LENGTH) {
                throw new IOException("Khối dữ liệu ảnh không hợp lệ.");
            }

            byte[] bytes;
            try {
                bytes = Base64.decode(encoded, Base64.NO_WRAP);
            } catch (IllegalArgumentException error) {
                throw new IOException("Khối dữ liệu ảnh không hợp lệ.", error);
            }
            if (bytes.length == 0 || bytes.length > MAX_CHUNK_BYTES
                || session.bytesWritten + bytes.length > session.expectedBytes) {
                throw new IOException("Kích thước khối dữ liệu ảnh vượt giới hạn.");
            }
            session.output.write(bytes);
            session.bytesWritten += bytes.length;
            call.resolve();
        });
    }

    @PluginMethod
    public void finishSave(PluginCall call) {
        enqueue(call, "Không thể hoàn tất lưu ảnh", () -> {
            String saveId = call.getString("saveId");
            SaveSession session = sessions.get(saveId);
            if (session == null) throw new IOException("Phiên lưu ảnh không còn hoạt động.");

            try {
                if (session.bytesWritten != session.expectedBytes) throw new IOException("Dữ liệu ảnh chưa được ghi đầy đủ.");
                session.output.flush();
                session.output.close();
                session.output = null;

                if (session.uri != null) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    int updated = getContext().getContentResolver().update(session.uri, values, null, null);
                    if (updated < 1) throw new IOException("Không thể hoàn tất mục ảnh trong thư viện.");
                    sessions.remove(saveId);
                    resolveSavedUri(call, session.uri.toString());
                    return;
                }

                File target = uniqueFile(session.directory, session.filename);
                if (session.temporaryFile == null || !session.temporaryFile.renameTo(target)) {
                    throw new IOException("Không thể đưa ảnh vào thư mục Pictures.");
                }
                session.finalFile = target;
                session.temporaryFile = null;
                sessions.remove(saveId);
                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[] { target.getAbsolutePath() },
                    new String[] { session.mimeType },
                    (path, uri) -> {
                        if (uri == null) {
                            target.delete();
                            call.reject("Android không thể thêm ảnh vào thư viện.");
                        } else {
                            resolveSavedUri(call, uri.toString());
                        }
                    }
                );
            } catch (Exception error) {
                sessions.remove(saveId);
                cleanup(session);
                throw error;
            }
        });
    }

    @PluginMethod
    public void abortSave(PluginCall call) {
        enqueue(call, "Không thể hủy lưu ảnh", () -> {
            SaveSession session = sessions.remove(call.getString("saveId"));
            if (session != null) cleanup(session);
            call.resolve();
        });
    }

    private SaveSession createSession(String saveId, String filename, String mimeType, long expectedBytes) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/MiniPhoto Editor");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("Android không thể tạo mục ảnh trong thư viện.");
            try {
                OutputStream output = resolver.openOutputStream(uri, "w");
                if (output == null) throw new IOException("Không thể mở luồng ghi ảnh.");
                return new SaveSession(filename, mimeType, expectedBytes, output, uri, null, null);
            } catch (IOException error) {
                resolver.delete(uri, null, null);
                throw error;
            }
        }

        File pictures = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
        File directory = new File(pictures, "MiniPhoto Editor");
        if ((!directory.isDirectory() && !directory.mkdirs()) || !directory.isDirectory()) {
            throw new IOException("Không thể tạo thư mục Pictures/MiniPhoto Editor.");
        }
        File temporaryFile = new File(directory, ".miniphoto-" + saveId + ".pending");
        try {
            OutputStream output = new FileOutputStream(temporaryFile);
            return new SaveSession(filename, mimeType, expectedBytes, output, null, directory, temporaryFile);
        } catch (IOException error) {
            temporaryFile.delete();
            throw error;
        }
    }

    private static String safeFilename(String input, String mimeType) throws IOException {
        String extension = extensionForMimeType(mimeType);
        String filename = input == null ? "" : input.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        int dot = filename.lastIndexOf('.');
        if (dot > 0) filename = filename.substring(0, dot);
        filename = filename.replaceAll("\\.+$", "").trim();
        if (filename.isEmpty()) filename = "miniphoto-edited";
        if (filename.length() > 100) filename = filename.substring(0, 100);
        return filename + extension;
    }

    private static String extensionForMimeType(String mimeType) throws IOException {
        if ("image/png".equals(mimeType)) return ".png";
        if ("image/jpeg".equals(mimeType)) return ".jpg";
        if ("image/webp".equals(mimeType)) return ".webp";
        throw new IOException("Định dạng ảnh không được hỗ trợ.");
    }

    private static File uniqueFile(File directory, String filename) {
        File target = new File(directory, filename);
        if (!target.exists()) return target;
        int dot = filename.lastIndexOf('.');
        String stem = dot > 0 ? filename.substring(0, dot) : filename;
        String extension = dot > 0 ? filename.substring(dot) : "";
        int suffix = 2;
        do {
            target = new File(directory, stem + " (" + suffix++ + ")" + extension);
        } while (target.exists());
        return target;
    }

    private void enqueue(PluginCall call, String failureMessage, IoTask task) {
        try {
            io.execute(() -> {
                try {
                    task.run();
                } catch (Exception error) {
                    String detail = error.getLocalizedMessage();
                    call.reject(detail == null || detail.isEmpty() ? failureMessage : failureMessage + ": " + detail, error);
                }
            });
        } catch (RejectedExecutionException error) {
            call.reject(failureMessage, error);
        }
    }

    private void cleanup(SaveSession session) {
        if (session.output != null) {
            try {
                session.output.close();
            } catch (IOException ignored) {}
            session.output = null;
        }
        if (session.uri != null) getContext().getContentResolver().delete(session.uri, null, null);
        if (session.temporaryFile != null) session.temporaryFile.delete();
        if (session.finalFile != null) session.finalFile.delete();
    }

    private static void resolveSavedUri(PluginCall call, String uri) {
        JSObject result = new JSObject();
        result.put("uri", uri);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        try {
            io.execute(() -> {
                for (SaveSession session : sessions.values()) cleanup(session);
                sessions.clear();
            });
            io.shutdown();
        } catch (RejectedExecutionException ignored) {}
        super.handleOnDestroy();
    }

    private interface IoTask {
        void run() throws Exception;
    }

    private static final class SaveSession {
        final String filename;
        final String mimeType;
        final long expectedBytes;
        final Uri uri;
        final File directory;
        OutputStream output;
        File temporaryFile;
        File finalFile;
        long bytesWritten;

        SaveSession(String filename, String mimeType, long expectedBytes, OutputStream output, Uri uri, File directory, File temporaryFile) {
            this.filename = filename;
            this.mimeType = mimeType;
            this.expectedBytes = expectedBytes;
            this.output = output;
            this.uri = uri;
            this.directory = directory;
            this.temporaryFile = temporaryFile;
        }
    }
}
