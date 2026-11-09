import Foundation
import Security

public protocol SessionStore: Sendable {
    func load() async throws -> AuthSession?
    func save(_ value: AuthSession) async throws
    func clear() async throws
}

public actor KeychainSessionStore: SessionStore {
    private let accessGroup: String?
    public init(accessGroup: String? = nil) { self.accessGroup = accessGroup }
    private var query: [String: Any] {
        var result: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "at.salescrew.simpl.mac.session",
            kSecAttrAccount as String: "authenticated-user",
            kSecUseDataProtectionKeychain as String: true,
        ]
        if let accessGroup, !accessGroup.contains("$("), !accessGroup.isEmpty {
            result[kSecAttrAccessGroup as String] = accessGroup
        }
        return result
    }
    public func load() throws -> AuthSession? {
        var attributes = query
        attributes[kSecReturnData as String] = true
        attributes[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let status = SecItemCopyMatching(attributes as CFDictionary, &value)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = value as? Data else { throw SIMPLError.keychain(status) }
        return try JSONDecoder().decode(AuthSession.self, from: data)
    }
    public func save(_ value: AuthSession) throws {
        let data = try JSONEncoder().encode(value)
        let update = [kSecValueData as String: data]
        var status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            var attributes = query
            attributes[kSecValueData as String] = data
            attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            status = SecItemAdd(attributes as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw SIMPLError.keychain(status) }
    }
    public func clear() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw SIMPLError.keychain(status) }
    }
}

public actor MemorySessionStore: SessionStore {
    private var value: AuthSession?
    public init(_ value: AuthSession? = nil) { self.value = value }
    public func load() -> AuthSession? { value }
    public func save(_ value: AuthSession) { self.value = value }
    public func clear() { value = nil }
}
