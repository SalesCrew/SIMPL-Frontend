import Foundation
import Darwin

public enum SharedLocation {
    public static var groupId: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SIMPLAppGroup") as? String,
              !value.contains("$("), !value.isEmpty else { return nil }
        return value
    }
    public static var keychainGroup: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SIMPLKeychainGroup") as? String,
              !value.contains("$("), !value.isEmpty else { return nil }
        return value
    }
    public static var groupContainer: URL? {
        groupId.flatMap { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: $0) }
    }
    public static var directory: URL {
        if let groupContainer { return groupContainer.appendingPathComponent("SIMPL", isDirectory: true) }
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("SIMPL/Local", isDirectory: true)
    }
}

/// A process-wide lease also serializes refresh-token rotation between the app
/// and the widget extension. Never store tokens in the shared JSON files.
public final class FileLease: @unchecked Sendable {
    private let descriptor: Int32
    private init(descriptor: Int32) { self.descriptor = descriptor }
    public static func acquire(in directory: URL) async throws -> FileLease {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700])
        let descriptor = Darwin.open(directory.appendingPathComponent("operation.lock").path, O_CREAT | O_RDWR, 0o600)
        guard descriptor >= 0 else { throw SIMPLError.storage }
        var acquired = false
        defer { if !acquired { Darwin.close(descriptor) } }
        let deadline = Date().addingTimeInterval(35)
        while flock(descriptor, LOCK_EX | LOCK_NB) != 0 {
            if Task.isCancelled || Date() >= deadline {
                throw SIMPLError.network
            }
            try await Task.sleep(for: .milliseconds(100))
        }
        acquired = true
        return FileLease(descriptor: descriptor)
    }
    deinit { flock(descriptor, LOCK_UN); Darwin.close(descriptor) }
}

public struct SharedStore: Sendable {
    public let directory: URL
    public init(directory: URL = SharedLocation.directory) { self.directory = directory }
    private func load<T: Decodable>(_ name: String, as: T.Type) -> T? {
        guard let data = try? Data(contentsOf: directory.appendingPathComponent(name)) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
    private func save<T: Encodable>(_ value: T, name: String) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700])
        let target = directory.appendingPathComponent(name)
        let data = try JSONEncoder().encode(value)
        let temporary = directory.appendingPathComponent(".\(UUID().uuidString).tmp")
        defer { try? FileManager.default.removeItem(at: temporary) }
        guard FileManager.default.createFile(atPath: temporary.path, contents: data,
            attributes: [.posixPermissions: 0o600]) else { throw SIMPLError.storage }
        guard Darwin.rename(temporary.path, target.path) == 0 else { throw SIMPLError.storage }
    }
    public func snapshot() -> TaskSnapshot { load("snapshot.json", as: TaskSnapshot.self) ?? TaskSnapshot() }
    public func preferences() -> UserPreferences { load("preferences.json", as: UserPreferences.self) ?? UserPreferences() }
    public func configuration() -> ServiceConfiguration? {
        guard let value = load("configuration.json", as: ServiceConfiguration.self),
              (try? value.validate()) != nil else { return nil }
        return value
    }
    public func save(_ snapshot: TaskSnapshot) throws { try save(snapshot, name: "snapshot.json") }
    public func save(_ preferences: UserPreferences) throws { try save(preferences, name: "preferences.json") }
    public func pendingAlerts() -> [LocalAlert] { load("alerts.json", as: [LocalAlert].self) ?? [] }
    public func saveAlerts(_ alerts: [LocalAlert]) throws { try save(alerts, name: "alerts.json") }
    public func save(_ configuration: ServiceConfiguration) throws {
        try configuration.validate()
        try save(configuration, name: "configuration.json")
    }
    public func removePrivateData(access: AccessState = .signedOut, message: String? = nil) throws -> TaskSnapshot {
        var empty = TaskSnapshot()
        empty.access = access; empty.errorMessage = message
        try save(empty)
        try saveAlerts([])
        for name in ["AttachmentCache", "AttachmentDrafts"] {
            try? FileManager.default.removeItem(at: directory.appendingPathComponent(name))
        }
        return empty
    }
}
