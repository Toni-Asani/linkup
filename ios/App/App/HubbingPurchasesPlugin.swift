import Foundation
import Capacitor
import StoreKit

enum HubbingPurchaseError: Error {
    case failedVerification
}

@objc(HubbingPurchasesPlugin)
public class HubbingPurchasesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HubbingPurchasesPlugin"
    public let jsName = "HubbingPurchases"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise)
    ]

    private var productCache: [String: Product] = [:]
    private let isoFormatter = ISO8601DateFormatter()

    @objc func getProducts(_ call: CAPPluginCall) {
        let productIds = call.getArray("productIds", String.self) ?? []
        guard !productIds.isEmpty else {
            call.reject("Missing product ids")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: productIds)
                for product in products {
                    self.productCache[product.id] = product
                }
                self.resolve(call, ["products": products.map { self.productPayload($0) }])
            } catch {
                self.reject(call, error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Missing product id")
            return
        }

        Task {
            do {
                let product = try await self.loadProduct(productId)
                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    let transaction = try self.checkVerified(verification)
                    await transaction.finish()
                    self.resolve(call, [
                        "transaction": self.transactionPayload(transaction),
                        "cancelled": false,
                        "pending": false
                    ])
                case .userCancelled:
                    self.resolve(call, ["cancelled": true, "pending": false])
                case .pending:
                    self.resolve(call, ["cancelled": false, "pending": true])
                @unknown default:
                    self.reject(call, NSError(domain: "HubbingPurchases", code: 500, userInfo: [
                        NSLocalizedDescriptionKey: "Unknown purchase result"
                    ]))
                }
            } catch HubbingPurchaseError.failedVerification {
                self.reject(call, NSError(domain: "HubbingPurchases", code: 401, userInfo: [
                    NSLocalizedDescriptionKey: "Apple could not verify this transaction"
                ]))
            } catch {
                self.reject(call, error)
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var transactions: [[String: Any]] = []

                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result {
                        transactions.append(self.transactionPayload(transaction))
                    }
                }

                self.resolve(call, ["transactions": transactions])
            } catch {
                self.reject(call, error)
            }
        }
    }

    private func loadProduct(_ productId: String) async throws -> Product {
        if let product = productCache[productId] {
            return product
        }

        guard let product = try await Product.products(for: [productId]).first else {
            throw NSError(domain: "HubbingPurchases", code: 404, userInfo: [
                NSLocalizedDescriptionKey: "Product not found"
            ])
        }

        productCache[product.id] = product
        return product
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let safe):
            return safe
        case .unverified:
            throw HubbingPurchaseError.failedVerification
        }
    }

    private func productPayload(_ product: Product) -> [String: Any] {
        var payload: [String: Any] = [
            "id": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice,
            "price": NSDecimalNumber(decimal: product.price).stringValue
        ]

        if let subscription = product.subscription {
            payload["subscriptionPeriod"] = [
                "value": subscription.subscriptionPeriod.value,
                "unit": periodUnit(subscription.subscriptionPeriod.unit)
            ]
        }

        return payload
    }

    private func transactionPayload(_ transaction: Transaction) -> [String: Any] {
        var payload: [String: Any] = [
            "productId": transaction.productID,
            "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID),
            "purchaseDate": isoFormatter.string(from: transaction.purchaseDate),
            "environment": String(describing: transaction.environment),
            "verified": true
        ]

        if let expirationDate = transaction.expirationDate {
            payload["expirationDate"] = isoFormatter.string(from: expirationDate)
        }

        if let revocationDate = transaction.revocationDate {
            payload["revocationDate"] = isoFormatter.string(from: revocationDate)
        }

        return payload
    }

    private func periodUnit(_ unit: Product.SubscriptionPeriod.Unit) -> String {
        switch unit {
        case .day:
            return "day"
        case .week:
            return "week"
        case .month:
            return "month"
        case .year:
            return "year"
        @unknown default:
            return "unknown"
        }
    }

    private func resolve(_ call: CAPPluginCall, _ data: [String: Any]) {
        DispatchQueue.main.async {
            call.resolve(data)
        }
    }

    private func reject(_ call: CAPPluginCall, _ error: Error) {
        DispatchQueue.main.async {
            call.reject(error.localizedDescription)
        }
    }
}
