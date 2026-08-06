//
//  ContentView.swift
//  GobidApp
//
//  Created by Serhat on 28.07.2026.
//

import SwiftUI

struct ContentView: View {
    @Environment(AuthSession.self) private var auth

    var body: some View {
        Group {
            switch auth.state {
            case .restoring:
                VStack(spacing: 16) {
                    Image("GobidMark")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 72, height: 72)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    ProgressView("Restoring session")
                }
            case .signedOut:
                AuthFlowView()
                    .transition(.opacity)
            case .signedIn:
                MainShellView()
                    .transition(.opacity)
            }
        }
        .animation(.smooth, value: auth.state)
        .task {
            if auth.state == .restoring {
                await auth.restore()
            }
        }
    }
}

#Preview {
    ContentView()
        .environment(AuthSession())
}
