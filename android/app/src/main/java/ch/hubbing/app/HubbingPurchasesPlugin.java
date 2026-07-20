package ch.hubbing.app;

import android.util.Log;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

@CapacitorPlugin(name = "HubbingPurchases")
public class HubbingPurchasesPlugin extends Plugin implements PurchasesUpdatedListener {
    private static final String TAG = "HubbingPurchases";

    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;
    private String pendingProductId;
    private String pendingReplacementMode;
    private final Map<String, ProductDetails> productDetailsById = new HashMap<>();

    private interface BillingReadyCallback {
        void onReady();
    }

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .enableAutoServiceReconnection()
            .build();
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        List<String> productIds = getStringList(call, "productIds");
        if (productIds == null || productIds.isEmpty()) {
            call.reject("Missing product ids");
            return;
        }

        queryProducts(productIds, call, productDetailsList -> {
            JSArray products = new JSArray();
            for (ProductDetails productDetails : productDetailsList) {
                productDetailsById.put(productDetails.getProductId(), productDetails);
                products.put(productPayload(productDetails));
            }

            JSObject response = new JSObject();
            response.put("products", products);
            call.resolve(response);
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        String accountId = call.getString("accountId");
        String replacementMode = call.getString("replacementMode", "none");
        if (productId == null || productId.trim().isEmpty()) {
            call.reject("Missing product id");
            return;
        }

        if (pendingPurchaseCall != null) {
            call.reject("A purchase is already in progress");
            return;
        }

        ensureBillingReady(call, () -> {
            ProductDetails cached = productDetailsById.get(productId);
            if (cached != null) {
                preparePurchaseFlow(call, productId, cached, accountId, replacementMode);
                return;
            }

            queryProducts(Collections.singletonList(productId), call, productDetailsList -> {
                if (productDetailsList.isEmpty()) {
                    call.reject("Product not found");
                    return;
                }
                ProductDetails productDetails = productDetailsList.get(0);
                productDetailsById.put(productDetails.getProductId(), productDetails);
                preparePurchaseFlow(call, productId, productDetails, accountId, replacementMode);
            });
        });
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        ensureBillingReady(call, () -> billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
            (billingResult, purchases) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject(billingResult.getDebugMessage());
                    return;
                }

                JSArray transactions = new JSArray();
                for (Purchase purchase : purchases) {
                    if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                        acknowledgeIfNeeded(purchase, null);
                        transactions.put(transactionPayload(purchase));
                    }
                }

                JSObject response = new JSObject();
                response.put("transactions", transactions);
                call.resolve(response);
            }
        ));
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        PluginCall call = pendingPurchaseCall;
        if (call == null) {
            return;
        }

        int responseCode = billingResult.getResponseCode();
        if (responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            resolvePurchase(call, null, true, false);
            clearPendingPurchase();
            return;
        }

        if (responseCode != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            call.reject(billingResult.getDebugMessage());
            clearPendingPurchase();
            return;
        }

        Purchase purchase = findPurchaseForPendingProduct(purchases);
        if (purchase == null) {
            call.reject("Purchase not found");
            clearPendingPurchase();
            return;
        }

        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            resolvePurchase(call, purchase, false, true);
            clearPendingPurchase();
            return;
        }

        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            acknowledgeIfNeeded(purchase, result -> {
                if (result != null && result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject(result.getDebugMessage());
                } else {
                    resolvePurchase(call, purchase, false, false);
                }
                clearPendingPurchase();
            });
            return;
        }

        call.reject("Unknown purchase state");
        clearPendingPurchase();
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null && billingClient.isReady()) {
            billingClient.endConnection();
        }
        super.handleOnDestroy();
    }

    private void ensureBillingReady(PluginCall call, BillingReadyCallback callback) {
        if (billingClient == null) {
            call.reject("Billing client unavailable");
            return;
        }

        if (billingClient.isReady()) {
            callback.onReady();
            return;
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    callback.onReady();
                } else {
                    call.reject(billingResult.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                Log.w(TAG, "Billing service disconnected");
            }
        });
    }

    private interface ProductQueryCallback {
        void onProducts(List<ProductDetails> productDetailsList);
    }

    private void queryProducts(List<String> productIds, PluginCall call, ProductQueryCallback callback) {
        ensureBillingReady(call, () -> {
            List<QueryProductDetailsParams.Product> products = new ArrayList<>();
            for (String productId : productIds) {
                products.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build());
            }

            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();

            billingClient.queryProductDetailsAsync(params, (billingResult, queryProductDetailsResult) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject(billingResult.getDebugMessage());
                    return;
                }
                callback.onProducts(queryProductDetailsResult.getProductDetailsList());
            });
        });
    }

    private void preparePurchaseFlow(
        PluginCall call,
        String productId,
        ProductDetails productDetails,
        String accountId,
        String replacementMode
    ) {
        billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
            (billingResult, purchases) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject(billingResult.getDebugMessage());
                    return;
                }

                Purchase existingPurchase = null;
                for (Purchase purchase : purchases) {
                    if (
                        purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED
                        && !purchase.getProducts().contains(productId)
                    ) {
                        existingPurchase = purchase;
                        break;
                    }
                }

                launchPurchaseFlow(
                    call,
                    productId,
                    productDetails,
                    accountId,
                    replacementMode,
                    existingPurchase
                );
            }
        );
    }

    private void launchPurchaseFlow(
        PluginCall call,
        String productId,
        ProductDetails productDetails,
        String accountId,
        String replacementMode,
        Purchase existingPurchase
    ) {
        String offerToken = firstOfferToken(productDetails);
        if (offerToken == null) {
            call.reject("Subscription offer not found");
            return;
        }

        pendingPurchaseCall = call;
        pendingProductId = productId;
        pendingReplacementMode = replacementMode;

        BillingFlowParams.ProductDetailsParams productDetailsParams =
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(productDetails)
                .setOfferToken(offerToken)
                .build();

        BillingFlowParams.Builder billingFlowBuilder = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(productDetailsParams));

        if (accountId != null && !accountId.trim().isEmpty()) {
            billingFlowBuilder.setObfuscatedAccountId(accountId);
        }

        if (existingPurchase != null) {
            int googleReplacementMode = "downgrade".equals(replacementMode)
                ? BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.DEFERRED
                : BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE;

            BillingFlowParams.SubscriptionUpdateParams updateParams =
                BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                    .setOldPurchaseToken(existingPurchase.getPurchaseToken())
                    .setSubscriptionReplacementMode(googleReplacementMode)
                    .build();
            billingFlowBuilder.setSubscriptionUpdateParams(updateParams);
        }

        BillingFlowParams billingFlowParams = billingFlowBuilder.build();

        BillingResult result = billingClient.launchBillingFlow(getActivity(), billingFlowParams);
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            clearPendingPurchase();
            call.reject(result.getDebugMessage());
        }
    }

    private String firstOfferToken(ProductDetails productDetails) {
        List<ProductDetails.SubscriptionOfferDetails> offers = productDetails.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) {
            return null;
        }
        return offers.get(0).getOfferToken();
    }

    private List<String> getStringList(PluginCall call, String key) {
        JSArray array = call.getArray(key);
        if (array == null) {
            return Collections.emptyList();
        }

        List<String> values = new ArrayList<>();
        for (int index = 0; index < array.length(); index++) {
            String value = array.optString(index, "");
            if (value != null && !value.trim().isEmpty()) {
                values.add(value);
            }
        }
        return values;
    }

    private ProductDetails.PricingPhase firstPricingPhase(ProductDetails productDetails) {
        List<ProductDetails.SubscriptionOfferDetails> offers = productDetails.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) {
            return null;
        }

        List<ProductDetails.PricingPhase> phases = offers.get(0)
            .getPricingPhases()
            .getPricingPhaseList();
        if (phases == null || phases.isEmpty()) {
            return null;
        }
        return phases.get(0);
    }

    private JSObject productPayload(ProductDetails productDetails) {
        JSObject payload = new JSObject();
        payload.put("id", productDetails.getProductId());
        payload.put("displayName", productDetails.getName());
        payload.put("description", productDetails.getDescription());

        String offerToken = firstOfferToken(productDetails);
        if (offerToken != null) {
            payload.put("offerToken", offerToken);
        }

        ProductDetails.PricingPhase phase = firstPricingPhase(productDetails);
        if (phase != null) {
            payload.put("displayPrice", phase.getFormattedPrice());
            payload.put("priceCurrencyCode", phase.getPriceCurrencyCode());
            payload.put("priceAmountMicros", phase.getPriceAmountMicros());
            payload.put("billingPeriod", phase.getBillingPeriod());
        }

        return payload;
    }

    private Purchase findPurchaseForPendingProduct(List<Purchase> purchases) {
        for (Purchase purchase : purchases) {
            if (purchase.getProducts().contains(pendingProductId)) {
                return purchase;
            }
        }
        return purchases.get(0);
    }

    private interface AcknowledgeCallback {
        void onAcknowledged(BillingResult result);
    }

    private void acknowledgeIfNeeded(Purchase purchase, AcknowledgeCallback callback) {
        if (purchase.isAcknowledged()) {
            if (callback != null) {
                callback.onAcknowledged(null);
            }
            return;
        }

        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();

        billingClient.acknowledgePurchase(params, billingResult -> {
            if (callback != null) {
                callback.onAcknowledged(billingResult);
            }
        });
    }

    private void resolvePurchase(PluginCall call, Purchase purchase, boolean cancelled, boolean pending) {
        JSObject response = new JSObject();
        response.put("cancelled", cancelled);
        response.put("pending", pending);
        response.put("requestedProductId", pendingProductId);
        response.put("replacementMode", pendingReplacementMode != null ? pendingReplacementMode : "none");
        if (purchase != null) {
            response.put("transaction", transactionPayload(purchase));
        }
        call.resolve(response);
    }

    private JSObject transactionPayload(Purchase purchase) {
        JSObject payload = new JSObject();
        String productId = purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0);
        payload.put("productId", productId);
        payload.put("transactionId", purchase.getOrderId() != null ? purchase.getOrderId() : purchase.getPurchaseToken());
        payload.put("originalTransactionId", purchase.getPurchaseToken());
        payload.put("purchaseToken", purchase.getPurchaseToken());
        payload.put("purchaseDate", isoDate(purchase.getPurchaseTime()));
        payload.put("packageName", purchase.getPackageName());
        payload.put("signature", purchase.getSignature());
        payload.put("acknowledged", purchase.isAcknowledged());
        payload.put("verified", false);

        if (purchase.getOrderId() != null) {
            payload.put("orderId", purchase.getOrderId());
        }

        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            payload.put("purchaseState", "PURCHASED");
        } else if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            payload.put("purchaseState", "PENDING");
        } else {
            payload.put("purchaseState", "UNKNOWN");
        }

        return payload;
    }

    private String isoDate(long timeMillis) {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
        return formatter.format(new Date(timeMillis));
    }

    private void clearPendingPurchase() {
        pendingPurchaseCall = null;
        pendingProductId = null;
        pendingReplacementMode = null;
    }
}
