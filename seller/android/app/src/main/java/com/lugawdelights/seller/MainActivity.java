package com.lugawdelights.seller;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BtPrinterPlugin.class); // Bluetooth receipt printer and cash drawer
        super.onCreate(savedInstanceState);
    }
}
