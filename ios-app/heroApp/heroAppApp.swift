//
//  heroAppApp.swift
//  heroApp
//
//  Created by Serhat on 28.07.2026.
//

import SwiftUI

@main
struct heroAppApp: App {
    @State private var auth = AuthSession()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(auth)
        }
    }
}
