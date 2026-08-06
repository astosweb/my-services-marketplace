//
//  GobidApp.swift
//  GobidApp
//
//  Created by Serhat on 28.07.2026.
//

import SwiftUI

@main
struct GobidApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var auth = AuthSession()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(auth)
                .task {
                    PushDeviceRegistration.shared.configure(auth: auth)
                }
                .onChange(of: auth.state) { _, state in
                    if state == .signedIn {
                        PushDeviceRegistration.shared.startIfSignedIn()
                    }
                }
        }
    }
}
