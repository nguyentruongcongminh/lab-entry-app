import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - LabEntry native due-time alarms (iOS)
//
// Bản web (v47+) gửi toàn bộ danh sách mẫu đang đếm giờ qua
// window.webkit.messageHandlers.labAlarm — mỗi phần tử {id, at (epoch ms), label}.
// LabAlarmCenter đồng bộ thông báo cục bộ (UNUserNotificationCenter) khớp đúng
// danh sách đó: iOS tự bắn thông báo đúng giờ kể cả khi app đã đóng hẳn.

import WebKit
import UserNotifications

final class LabAlarmCenter: NSObject, WKScriptMessageHandler {
    static let shared = LabAlarmCenter()
    private let defaultsKey = "labentry.alarms.json"
    private let prefix = "labentry-"

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "labAlarm" else { return }
        var jsonText: String?
        if let s = message.body as? String {
            jsonText = s
        } else if let obj = message.body as? [Any],
                  let data = try? JSONSerialization.data(withJSONObject: obj),
                  let s = String(data: data, encoding: .utf8) {
            jsonText = s
        }
        guard let text = jsonText, let data = text.data(using: .utf8),
              let list = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] else { return }
        sync(list)
    }

    private func sync(_ raw: [[String: Any]]) {
        let center = UNUserNotificationCenter.current()
        // Xin quyền thông báo khi có mẫu đang đếm (chỉ hiện hộp thoại lúc chưa quyết định)
        center.getNotificationSettings { settings in
            if settings.authorizationStatus == .notDetermined {
                center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
            }
        }
        struct Item { let id: String; let at: Date; let label: String }
        let items: [Item] = raw.compactMap { o in
            guard let id = o["id"] as? String, let atMs = o["at"] as? NSNumber else { return nil }
            return Item(id: id,
                        at: Date(timeIntervalSince1970: atMs.doubleValue / 1000.0),
                        label: (o["label"] as? String) ?? id)
        }
        // Registry cũ để biết báo nào cần hủy
        var old: [String: [String: Any]] = [:]
        if let text = UserDefaults.standard.string(forKey: defaultsKey),
           let data = text.data(using: .utf8),
           let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: [String: Any]] {
            old = obj
        }
        let newIds = Set(items.map { $0.id })
        let removed = old.keys.filter { !newIds.contains($0) }.map { prefix + $0 }
        if !removed.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: removed)
            center.removeDeliveredNotifications(withIdentifiers: removed)
        }
        var registry: [String: [String: Any]] = [:]
        for item in items {
            registry[item.id] = ["at": item.at.timeIntervalSince1970 * 1000, "label": item.label]
            let content = UNMutableNotificationContent()
            content.title = "Tới giờ nhập kết quả"
            content.body = item.label + " — mở LabEntry để nhập kết quả."
            content.sound = .default
            if #available(iOS 15.0, *) {
                content.interruptionLevel = .timeSensitive
            }
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: item.at)
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            let request = UNNotificationRequest(identifier: prefix + item.id, content: content, trigger: trigger)
            center.add(request) { _ in }
        }
        if let data = try? JSONSerialization.data(withJSONObject: registry),
           let text = String(data: data, encoding: .utf8) {
            UserDefaults.standard.set(text, forKey: defaultsKey)
        }
    }
}

extension LabAlarmCenter: UNUserNotificationCenterDelegate {
    // App đang mở vẫn hiện banner + kêu như khi app đóng
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }
}

/// View controller gốc của app: gắn trình nhận tin "labAlarm" vào WebView ngay khi Capacitor sẵn sàng.
class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.webView?.configuration.userContentController.add(LabAlarmCenter.shared, name: "labAlarm")
    }
}
