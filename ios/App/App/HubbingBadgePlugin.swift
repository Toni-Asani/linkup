import Foundation
import Capacitor
import UIKit
import UserNotifications

@objc(HubbingBadgePlugin)
public class HubbingBadgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HubbingBadgePlugin"
    public let jsName = "HubbingBadge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setBadgeCount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearBadge", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showNotification", returnType: CAPPluginReturnPromise)
    ]

    @objc func setBadgeCount(_ call: CAPPluginCall) {
        let count = max(0, call.getInt("count") ?? 0)

        if count == 0 {
            setSystemBadgeCount(0) { error in
                self.complete(call, error: error, data: ["granted": true, "count": 0])
            }
            return
        }

        UNUserNotificationCenter.current().requestAuthorization(options: [.badge]) { granted, error in
            if let error = error {
                self.complete(call, error: error)
                return
            }

            guard granted else {
                self.complete(call, data: ["granted": false, "count": count])
                return
            }

            self.setSystemBadgeCount(count) { badgeError in
                self.complete(call, error: badgeError, data: ["granted": true, "count": count])
            }
        }
    }

    @objc func clearBadge(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        setSystemBadgeCount(0) { error in
            self.complete(call, error: error, data: ["granted": true, "count": 0])
        }
    }

    @objc func showNotification(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "Hubbing"
        let body = call.getString("body") ?? ""
        let identifier = call.getString("id") ?? UUID().uuidString
        let badgeCount = call.getInt("count")

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error = error {
                self.complete(call, error: error)
                return
            }

            guard granted else {
                self.complete(call, data: ["granted": false])
                return
            }

            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            if let badgeCount = badgeCount {
                content.badge = NSNumber(value: max(0, badgeCount))
            }

            let request = UNNotificationRequest(identifier: identifier, content: content, trigger: nil)
            UNUserNotificationCenter.current().add(request) { notificationError in
                self.complete(call, error: notificationError, data: ["granted": true])
            }
        }
    }

    private func setSystemBadgeCount(_ count: Int, completion: @escaping (Error?) -> Void) {
        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = count
        }

        if count == 0 {
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        }

        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(count) { error in
                completion(error)
            }
        } else {
            DispatchQueue.main.async {
                UIApplication.shared.applicationIconBadgeNumber = count
                completion(nil)
            }
        }
    }

    private func complete(_ call: CAPPluginCall, error: Error? = nil, data: [String: Any] = [:]) {
        DispatchQueue.main.async {
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve(data)
            }
        }
    }
}
