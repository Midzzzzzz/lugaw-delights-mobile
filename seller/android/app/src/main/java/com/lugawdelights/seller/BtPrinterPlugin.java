package com.lugawdelights.seller;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Sends raw ESC/POS bytes to a paired Bluetooth receipt printer (for example the JK-5801H),
 * over the classic Bluetooth serial profile. The cash drawer plugged into the printer opens
 * when the page sends the printer the "open drawer" command.
 *
 * From the page: Capacitor.Plugins.BtPrinter.list()            -> { devices: [{ name, address }] }
 *                Capacitor.Plugins.BtPrinter.write({ address, data })   data = base64 bytes
 */
@CapacitorPlugin(
    name = "BtPrinter",
    permissions = { @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT }) }
)
public class BtPrinterPlugin extends Plugin {
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private BluetoothSocket socket;
    private String socketAddress;

    // Android 12 and newer ask for "Nearby devices" before an app can use paired devices
    private boolean needsPermission() {
        return Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") != PermissionState.GRANTED;
    }

    private BluetoothAdapter adapter() {
        BluetoothManager m = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return m == null ? null : m.getAdapter();
    }

    @PluginMethod
    public void list(PluginCall call) {
        if (needsPermission()) { requestPermissionForAlias("bluetooth", call, "listAfterPermission"); return; }
        doList(call);
    }

    @PermissionCallback
    private void listAfterPermission(PluginCall call) {
        if (needsPermission()) { call.reject("Allow \"Nearby devices\" for the app so it can use the printer."); return; }
        doList(call);
    }

    @SuppressLint("MissingPermission")
    private void doList(PluginCall call) {
        BluetoothAdapter a = adapter();
        if (a == null) { call.reject("This device has no Bluetooth."); return; }
        if (!a.isEnabled()) { call.reject("Turn on Bluetooth first."); return; }
        JSArray devices = new JSArray();
        try {
            for (BluetoothDevice d : a.getBondedDevices()) {
                JSObject o = new JSObject();
                String name = d.getName();
                o.put("name", name == null || name.isEmpty() ? d.getAddress() : name);
                o.put("address", d.getAddress());
                devices.put(o);
            }
        } catch (SecurityException e) {
            call.reject("Allow \"Nearby devices\" for the app so it can use the printer.");
            return;
        }
        JSObject r = new JSObject();
        r.put("devices", devices);
        call.resolve(r);
    }

    @PluginMethod
    public void write(PluginCall call) {
        if (needsPermission()) { requestPermissionForAlias("bluetooth", call, "writeAfterPermission"); return; }
        doWrite(call);
    }

    @PermissionCallback
    private void writeAfterPermission(PluginCall call) {
        if (needsPermission()) { call.reject("Allow \"Nearby devices\" for the app so it can use the printer."); return; }
        doWrite(call);
    }

    private void doWrite(PluginCall call) {
        String address = call.getString("address"), data = call.getString("data");
        if (address == null || data == null) { call.reject("No printer chosen."); return; }
        final byte[] bytes;
        try { bytes = Base64.decode(data, Base64.DEFAULT); } catch (IllegalArgumentException e) { call.reject("Bad print data."); return; }
        io.execute(() -> {
            try {
                send(address, bytes);
                call.resolve();
            } catch (Exception first) {
                // the printer may have been switched off and on: connect again once
                close();
                try { send(address, bytes); call.resolve(); }
                catch (Exception e) { close(); call.reject("Couldn't reach the printer. Check that it's on and near the tablet."); }
            }
        });
    }

    @SuppressLint("MissingPermission")
    private synchronized void send(String address, byte[] bytes) throws IOException {
        if (socket == null || !socket.isConnected() || !address.equals(socketAddress)) {
            close();
            BluetoothAdapter a = adapter();
            if (a == null || !a.isEnabled()) throw new IOException("Bluetooth is off");
            BluetoothDevice d = a.getRemoteDevice(address);
            BluetoothSocket s;
            try {
                s = d.createRfcommSocketToServiceRecord(SPP);
                s.connect();
            } catch (IOException secureFailed) {
                // many small printers only accept the insecure connection
                s = d.createInsecureRfcommSocketToServiceRecord(SPP);
                s.connect();
            }
            socket = s;
            socketAddress = address;
        }
        OutputStream out = socket.getOutputStream();
        out.write(bytes);
        out.flush();
    }

    private synchronized void close() {
        try { if (socket != null) socket.close(); } catch (IOException ignored) { }
        socket = null;
        socketAddress = null;
    }

    @Override
    protected void handleOnDestroy() {
        close();
        io.shutdown();
    }
}
