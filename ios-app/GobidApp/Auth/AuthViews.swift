import SwiftUI
import UIKit

private enum AuthRoute: Hashable {
    case register
    case forgot
    case reset
}

struct AuthFlowView: View {
    @Environment(AuthSession.self) private var auth
    @State private var path: [AuthRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            LoginView(
                showRegister: { path.append(.register) },
                showForgot: { path.append(.forgot) }
            )
            .navigationDestination(for: AuthRoute.self) { route in
                switch route {
                case .register:
                    RegisterView()
                case .forgot:
                    ForgotPasswordView(
                        showReset: { path.append(.reset) }
                    )
                case .reset:
                    ResetPasswordView(
                        onSuccess: {
                            path.removeAll { $0 == .reset || $0 == .forgot }
                        }
                    )
                }
            }
        }
    }
}

private struct AuthShell<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                VStack(spacing: 16) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 56, weight: .semibold))
                        .foregroundStyle(
                            LinearGradient(colors: [.accentColor, .accentColor.opacity(0.6)], startPoint: .topLeading, endPoint: .bottomTrailing)
                        )
                        .symbolEffect(.bounce, options: .nonRepeating)
                        .accessibilityHidden(true)
                    
                    Text(title)
                        .font(.system(.largeTitle, design: .rounded).bold())
                        .accessibilityAddTraits(.isHeader)
                    
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding(.top, 24)

                content
                    .padding(24)
                    .background(
                        .ultraThinMaterial,
                        in: RoundedRectangle(cornerRadius: 28, style: .continuous)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .stroke(Color.primary.opacity(0.05), lineWidth: 1)
                    )
                    .shadow(color: .black.opacity(0.08), radius: 24, y: 12)
            }
            .frame(maxWidth: 480)
            .padding(.horizontal, 24)
            .padding(.vertical, 36)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background {
            ZStack {
                Color(.systemGroupedBackground).ignoresSafeArea()
                
                Circle()
                    .fill(Color.accentColor.opacity(0.15))
                    .frame(width: 300, height: 300)
                    .blur(radius: 60)
                    .offset(x: -100, y: -200)
                
                Circle()
                    .fill(Color.purple.opacity(0.15))
                    .frame(width: 300, height: 300)
                    .blur(radius: 60)
                    .offset(x: 150, y: 100)
            }
            .ignoresSafeArea()
        }
    }
}

private struct LoginView: View {
    @Environment(AuthSession.self) private var auth
    @FocusState private var focusedField: Field?
    @State private var email = ""
    @State private var password = ""
    @State private var passwordVisible = false
    @State private var validationMessage: String?
    @State private var feedbackTrigger = false
    let showRegister: () -> Void
    let showForgot: () -> Void

    private enum Field { case email, password }

    var body: some View {
        @Bindable var auth = auth
        AuthShell(title: "Welcome back", subtitle: "Sign in to continue helping nearby.") {
            VStack(spacing: 16) {
                AuthTextField(
                    title: "Email",
                    text: $email,
                    contentType: .emailAddress,
                    keyboard: .emailAddress,
                    isSecure: false
                )
                .focused($focusedField, equals: .email)
                .submitLabel(.next)
                .onSubmit { focusedField = .password }

                AuthPasswordField(
                    title: "Password",
                    text: $password,
                    visible: $passwordVisible
                )
                .focused($focusedField, equals: .password)
                .submitLabel(.go)
                .onSubmit { Task { await submit() } }

                Toggle("Remember me", isOn: $auth.rememberMe)
                    .accessibilityHint("Keeps you signed in on this device")

                if let message = validationMessage ?? auth.errorMessage {
                    AuthNotice(message, kind: .error)
                }

                AuthPrimaryButton(
                    title: "Sign In",
                    isLoading: auth.isWorking
                ) {
                    Task { await submit() }
                }

                HStack {
                    Button("Forgot password?", action: showForgot)
                        .fontWeight(.medium)
                    Spacer()
                    Button("Create account", action: showRegister)
                        .fontWeight(.medium)
                }
                .font(.callout)

                Divider()

                Text("Quick seed login")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: 12) {
                    Button("Moonika") {
                        Task { await loginAsSeed(email: "moonika@gobid.test") }
                    }
                    .buttonStyle(.bordered)
                    .disabled(auth.isWorking)

                    Button("Raivo") {
                        Task { await loginAsSeed(email: "raivo@gobid.test") }
                    }
                    .buttonStyle(.bordered)
                    .disabled(auth.isWorking)
                }
            }
        }
        .navigationBarBackButtonHidden()
        .sensoryFeedback(.error, trigger: feedbackTrigger)
    }

    private func loginAsSeed(email: String) async {
        self.email = email
        password = "password123"
        await submit()
    }

    private func submit() async {
        validationMessage = nil
        auth.errorMessage = nil
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedEmail.contains("@"), !password.isEmpty else {
            validationMessage = "Enter a valid email and password."
            feedbackTrigger.toggle()
            return
        }
        if !(await auth.login(email: trimmedEmail, password: password)) {
            feedbackTrigger.toggle()
        }
    }
}

private struct RegisterView: View {
    @Environment(AuthSession.self) private var auth
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var passwordVisible = false
    @State private var validationMessage: String?
    @State private var feedbackTrigger = false

    var body: some View {
        AuthShell(title: "Join Gobid", subtitle: "Create an account in a few seconds.") {
            VStack(spacing: 16) {
                AuthTextField(title: "Display name", text: $name, contentType: .name)
                AuthTextField(
                    title: "Email",
                    text: $email,
                    contentType: .emailAddress,
                    keyboard: .emailAddress
                )
                AuthPasswordField(title: "Password", text: $password, visible: $passwordVisible)
                AuthTextField(
                    title: "Confirm password",
                    text: $confirmPassword,
                    contentType: .newPassword,
                    isSecure: true
                )

                if let message = validationMessage ?? auth.errorMessage {
                    AuthNotice(message, kind: .error)
                }

                AuthPrimaryButton(title: "Create Account", isLoading: auth.isWorking) {
                    Task { await submit() }
                }
            }
        }
        .navigationTitle("Register")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.error, trigger: feedbackTrigger)
    }

    private func submit() async {
        validationMessage = nil
        auth.errorMessage = nil
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            validationMessage = "Enter your display name."
            feedbackTrigger.toggle()
            return
        }
        guard trimmedEmail.contains("@") else {
            validationMessage = "Enter a valid email."
            feedbackTrigger.toggle()
            return
        }
        guard password.count >= 8 else {
            validationMessage = "Password must contain at least 8 characters."
            feedbackTrigger.toggle()
            return
        }
        guard password == confirmPassword else {
            validationMessage = "Passwords do not match."
            feedbackTrigger.toggle()
            return
        }
        if !(await auth.register(displayName: trimmedName, email: trimmedEmail, password: password)) {
            feedbackTrigger.toggle()
        }
    }
}

private struct ForgotPasswordView: View {
    @Environment(AuthSession.self) private var auth
    @State private var email = ""
    @State private var validationMessage: String?
    @State private var successMessage: String?
    @State private var feedbackTrigger = false
    let showReset: () -> Void

    var body: some View {
        AuthShell(
            title: "Reset password",
            subtitle: "We’ll create a reset token if that email has an account."
        ) {
            VStack(spacing: 16) {
                AuthTextField(
                    title: "Email",
                    text: $email,
                    contentType: .emailAddress,
                    keyboard: .emailAddress
                )

                if let validationMessage {
                    AuthNotice(validationMessage, kind: .error)
                }
                if let successMessage {
                    AuthNotice(successMessage, kind: .success)
                }
                if let error = auth.errorMessage {
                    AuthNotice(error, kind: .error)
                }

                AuthPrimaryButton(title: "Request Reset", isLoading: auth.isWorking) {
                    Task { await submit() }
                }

                Button("I already have a reset code", action: showReset)
                    .font(.callout)
            }
        }
        .navigationTitle("Forgot Password")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.error, trigger: feedbackTrigger)
    }

    private func submit() async {
        validationMessage = nil
        successMessage = nil
        auth.errorMessage = nil
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedEmail.contains("@") else {
            validationMessage = "Enter a valid email."
            feedbackTrigger.toggle()
            return
        }
        if let message = await auth.requestPasswordReset(email: trimmedEmail) {
            if auth.developmentResetToken != nil {
                successMessage = "\(message) Development token is ready on the next screen."
                showReset()
            } else {
                successMessage = message
            }
        } else {
            feedbackTrigger.toggle()
        }
    }
}

private struct ResetPasswordView: View {
    @Environment(AuthSession.self) private var auth
    @State private var token = ""
    @State private var password = ""
    @State private var passwordVisible = false
    @State private var validationMessage: String?
    @State private var successMessage: String?
    @State private var feedbackTrigger = false
    let onSuccess: () -> Void

    var body: some View {
        AuthShell(title: "Choose password", subtitle: "Enter your reset token and a new password.") {
            VStack(spacing: 16) {
                AuthTextField(title: "Reset token", text: $token, contentType: .oneTimeCode)
                AuthPasswordField(title: "New password", text: $password, visible: $passwordVisible)

                if let validationMessage {
                    AuthNotice(validationMessage, kind: .error)
                }
                if let successMessage {
                    AuthNotice(successMessage, kind: .success)
                }
                if let error = auth.errorMessage {
                    AuthNotice(error, kind: .error)
                }

                AuthPrimaryButton(title: "Reset Password", isLoading: auth.isWorking) {
                    Task { await submit() }
                }
            }
        }
        .navigationTitle("Reset Password")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if token.isEmpty, let developmentToken = auth.developmentResetToken {
                token = developmentToken
            }
        }
        .sensoryFeedback(.error, trigger: feedbackTrigger)
    }

    private func submit() async {
        validationMessage = nil
        successMessage = nil
        auth.errorMessage = nil
        let trimmedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedToken.isEmpty, password.count >= 8 else {
            validationMessage = "Enter a reset token and at least 8 characters."
            feedbackTrigger.toggle()
            return
        }
        if await auth.resetPassword(token: trimmedToken, password: password) {
            successMessage = "Password updated. You can sign in with the new password."
            try? await Task.sleep(for: .milliseconds(700))
            onSuccess()
        } else {
            feedbackTrigger.toggle()
        }
    }
}

private struct AuthTextField: View {
    let title: String
    @Binding var text: String
    var contentType: UITextContentType?
    var keyboard: UIKeyboardType = .default
    var isSecure = false

    var body: some View {
        Group {
            if isSecure {
                SecureField(title, text: $text)
            } else {
                TextField(title, text: $text)
            }
        }
        .textContentType(contentType)
        .keyboardType(keyboard)
        .textInputAutocapitalization(keyboard == .emailAddress ? .never : .sentences)
        .autocorrectionDisabled(keyboard == .emailAddress)
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
        )
        .accessibilityLabel(title)
    }
}

private struct AuthPasswordField: View {
    let title: String
    @Binding var text: String
    @Binding var visible: Bool

    var body: some View {
        HStack {
            Group {
                if visible {
                    TextField(title, text: $text)
                } else {
                    SecureField(title, text: $text)
                }
            }
            .textContentType(.password)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()

            Button {
                visible.toggle()
            } label: {
                Image(systemName: visible ? "eye.slash.fill" : "eye.fill")
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(visible ? "Hide password" : "Show password")
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
    }
}

private struct AuthPrimaryButton: View {
    let title: String
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text(title)
                        .font(.system(.headline, design: .rounded).bold())
                }
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                LinearGradient(
                    colors: [Color.accentColor, Color.accentColor.opacity(0.8)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: Color.accentColor.opacity(0.3), radius: 10, y: 5)
        }
        .disabled(isLoading)
        .opacity(isLoading ? 0.7 : 1.0)
        .accessibilityLabel(title)
        .accessibilityHint(isLoading ? "Loading" : "Double tap to submit")
    }
}

private struct AuthNotice: View {
    enum Kind { case error, success }
    let message: String
    let kind: Kind

    init(_ message: String, kind: Kind) {
        self.message = message
        self.kind = kind
    }

    var body: some View {
        Label(
            message,
            systemImage: kind == .error ? "exclamationmark.circle.fill" : "checkmark.circle.fill"
        )
        .font(.callout)
        .foregroundStyle(kind == .error ? .red : .green)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityAddTraits(.isStaticText)
    }
}

#Preview("Authentication") {
    AuthFlowView()
        .environment(AuthSession())
}

#Preview("Authentication Dark") {
    AuthFlowView()
        .environment(AuthSession())
        .preferredColorScheme(.dark)
}
