import Foundation

public struct ServiceConfiguration: Codable, Equatable, Sendable {
    public var supabaseURL: URL
    public var publishableKey: String
    public var apiURL: URL
    public var appURL: URL
    public init(supabaseURL: URL, publishableKey: String, apiURL: URL, appURL: URL) throws {
        self.supabaseURL = supabaseURL; self.publishableKey = publishableKey
        self.apiURL = apiURL; self.appURL = appURL
        try validate()
    }
    public func validate() throws {
        guard supabaseURL.scheme == "https", supabaseURL.host == "xqvexzoswhraqicbmckj.supabase.co",
              apiURL.scheme == "https", appURL.scheme == "https",
              supabaseURL.user == nil, apiURL.user == nil, appURL.user == nil,
              [supabaseURL, apiURL, appURL].allSatisfy({ $0.password == nil && $0.query == nil && $0.fragment == nil }),
              [supabaseURL, apiURL, appURL].allSatisfy({ $0.host != nil && $0.port == nil }),
              supabaseURL.path.isEmpty || supabaseURL.path == "/" else {
            throw SIMPLError.configurationRejected
        }
        if publishableKey.hasPrefix("sb_publishable_"), publishableKey.count > 20 { return }
        // A legacy anon JWT may be used; a privileged key must never enter this client.
        let pieces = publishableKey.split(separator: ".")
        guard pieces.count == 3 else { throw SIMPLError.configurationRejected }
        var payload = String(pieces[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
        guard let data = Data(base64Encoded: payload),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              object["role"] as? String == "anon" else { throw SIMPLError.configurationRejected }
    }
    public func cardURL(_ id: String) -> URL {
        var parts = URLComponents(url: appURL, resolvingAgainstBaseURL: false)!
        parts.queryItems = [URLQueryItem(name: "card", value: id)]
        return parts.url!
    }
    public static func bundled() -> ServiceConfiguration? {
        guard let file = Bundle.main.url(forResource: "ServiceConfiguration", withExtension: "json"),
              let data = try? Data(contentsOf: file),
              let result = try? JSONDecoder().decode(Self.self, from: data),
              (try? result.validate()) != nil else { return nil }
        return result
    }
}
