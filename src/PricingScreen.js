import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { getUiText } from './i18n'
import { APPLE_PRODUCT_IDS, HubbingPurchases } from './applePurchases'
import { isNativeIOS } from './platform'

const getPlans = (ui) => [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    color: '#666',
    features: ui.pricing.starterFeatures,
    limits: ui.pricing.starterLimits,
    cta: ui.common.free,
    disabled: true
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 19,
    color: '#185FA5',
    priceId: process.env.REACT_APP_STRIPE_PRICE_BASIC,
    appleProductId: APPLE_PRODUCT_IDS.basic,
    features: ui.pricing.basicFeatures,
    limits: ui.pricing.basicLimits,
    cta: ui.pricing.chooseBasic,
    disabled: false
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 39,
    color: '#E24B4A',
    priceId: process.env.REACT_APP_STRIPE_PRICE_PREMIUM,
    appleProductId: APPLE_PRODUCT_IDS.premium,
    features: ui.pricing.premiumFeatures,
    limits: ui.pricing.premiumLimits,
    founderFeature: ui.pricing.premiumFounderFeature,
    cta: ui.pricing.choosePremium,
    disabled: false,
    highlighted: true,
    founder: true
  }
]

export default function PricingScreen({ user, setActiveTab, lang = 'fr' }) {
  const ui = getUiText(lang)
  const plans = getPlans(ui)
  const nativeIOS = isNativeIOS()
  const [currentPlan, setCurrentPlan] = useState('starter')
  const [loading, setLoading] = useState(null)
  const [restoring, setRestoring] = useState(false)
  const [appleProducts, setAppleProducts] = useState({})
  const [founderSlots, setFounderSlots] = useState({ used: 0, max: 100 })
  const [testModeEnabled, setTestModeEnabled] = useState(false)
  const [testPlanChanging, setTestPlanChanging] = useState(null)

  useEffect(() => {
    loadCurrentPlan()
    loadFounderSlots()
    loadTestModeAccess()
  }, [])

  useEffect(() => {
    if (nativeIOS) loadAppleProducts()
  }, [nativeIOS])

  const loadCurrentPlan = async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .single()
    if (data) setCurrentPlan(data.plan)
  }

  const loadFounderSlots = async () => {
    const { data } = await supabase
      .from('founder_slots').select('*').eq('id', 1).single()
    if (data) setFounderSlots({ used: data.used, max: data.max_slots })
  }

  const loadTestModeAccess = async () => {
    const { data } = await supabase
      .from('test_subscription_users')
      .select('enabled')
      .eq('user_id', user.id)
      .eq('enabled', true)
      .maybeSingle()
    setTestModeEnabled(Boolean(data?.enabled))
  }

  const loadAppleProducts = async () => {
    try {
      const productIds = plans.filter(plan => plan.appleProductId).map(plan => plan.appleProductId)
      const result = await HubbingPurchases.getProducts({ productIds })
      const productsById = Object.fromEntries((result.products || []).map(product => [product.id, product]))
      setAppleProducts(productsById)
    } catch (e) {
      console.warn('Apple products unavailable:', e)
    }
  }

  const saveSubscription = async (plan, transaction = {}) => {
    const isFounder = !nativeIOS && plan.id === 'premium' && remaining > 0
    const fallbackDays = isFounder ? 60 : 30
    const currentPeriodEndsAt = transaction.expirationDate || new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase.from('subscriptions').upsert({
      user_id: user.id,
      plan: plan.id,
      status: 'active',
      is_founder: isFounder,
      current_period_ends_at: currentPeriodEndsAt
    }, { onConflict: 'user_id' })
    if (error) throw error
    setCurrentPlan(plan.id)
  }

  const handleAppleSubscribe = async (plan) => {
    if (!plan.appleProductId) throw new Error(ui.pricing.appleProductsUnavailable)
    const result = await HubbingPurchases.purchase({ productId: plan.appleProductId })
    if (result.cancelled) return
    if (result.pending) {
      alert(ui.pricing.purchasePending)
      return
    }
    await saveSubscription(plan, result.transaction)
    alert(ui.pricing.purchaseSuccess(plan.name))
  }

  const handleRestorePurchases = async () => {
    setRestoring(true)
    try {
      const result = await HubbingPurchases.restorePurchases()
      const transactions = result.transactions || []
      const premium = transactions.find(transaction => transaction.productId === APPLE_PRODUCT_IDS.premium)
      const basic = transactions.find(transaction => transaction.productId === APPLE_PRODUCT_IDS.basic)
      const transaction = premium || basic
      if (!transaction) {
        alert(ui.pricing.noPurchaseToRestore)
        return
      }
      const plan = plans.find(item => item.appleProductId === transaction.productId)
      if (!plan) throw new Error(ui.pricing.appleProductsUnavailable)
      await saveSubscription(plan, transaction)
      alert(ui.pricing.purchaseRestored)
    } catch (e) {
      alert(ui.pricing.purchaseError(e.message))
    } finally {
      setRestoring(false)
    }
  }

  const handleSubscribe = async (plan) => {
    if (plan.disabled || currentPlan === plan.id) return
    setLoading(plan.id)

    try {
      if (nativeIOS) {
        await handleAppleSubscribe(plan)
        return
      }

      const response = await fetch(
        `https://rxjrcbdeyouafhtizneh.supabase.co/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            priceId: plan.priceId,
            userId: user.id,
            planName: plan.id,
            founder: plan.founder && remaining > 0,
          }),
        }
      )

      const { url, error } = await response.json()
      if (error) throw new Error(error)

      window.location.href = url

    } catch (e) {
      alert(ui.pricing.purchaseError(e.message))
    } finally {
      setLoading(null)
    }
  }

  const handleTestPlanChange = async (plan) => {
    setTestPlanChanging(plan.id)
    try {
      const { data, error } = await supabase.rpc('hubbing_set_test_subscription_plan', {
        plan_name: plan.id
      })
      if (error) throw error
      setCurrentPlan(data?.plan || plan.id)
      alert(ui.pricing.testModeSuccess(plan.name))
    } catch (e) {
      alert(ui.pricing.purchaseError(e.message))
    } finally {
      setTestPlanChanging(null)
    }
  }

  const remaining = founderSlots.max - founderSlots.used
  const getPriceLabel = (plan) => {
    if (nativeIOS && plan.appleProductId && appleProducts[plan.appleProductId]?.displayPrice) {
      return appleProducts[plan.appleProductId].displayPrice
    }
    if (plan.price === 0) return ui.common.free
    return `CHF ${plan.price}`
  }

  return (
    <div style={{flex:1,overflowY:'auto',padding:'1.5rem 1rem'}}>

      <div style={{textAlign:'center',marginBottom:'1.5rem'}}>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:8}}>{ui.pricing.title}</h2>
        <p style={{fontSize:14,color:'#666'}}>{ui.pricing.subtitle}</p>
      </div>

      {!nativeIOS && (
        <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'0.875rem',marginBottom:'1.25rem',textAlign:'center'}}>
          <p style={{fontSize:13,color:'#E24B4A',fontWeight:600,margin:0}}>
            {ui.pricing.limitedOffer(remaining)}
          </p>
          <div style={{background:'#fee2e2',borderRadius:8,overflow:'hidden',height:6,margin:'8px 0 4px'}}>
            <div style={{height:'100%',background:'#E24B4A',width:`${(founderSlots.used/founderSlots.max)*100}%`,borderRadius:8}} />
          </div>
          <p style={{fontSize:12,color:'#666',margin:0}}>{ui.pricing.founderDesc}</p>
        </div>
      )}

      {testModeEnabled && (
        <div style={{background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:12,padding:'0.875rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#334155',marginBottom:4}}>
            {ui.pricing.testModeTitle}
          </div>
          <p style={{fontSize:12,color:'#64748B',margin:'0 0 0.75rem',lineHeight:1.4}}>
            {ui.pricing.testModeDesc}
          </p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:8}}>
            {plans.map(plan => {
              const active = currentPlan === plan.id
              return (
                <button
                  key={`test-${plan.id}`}
                  onClick={() => handleTestPlanChange(plan)}
                  disabled={active || Boolean(testPlanChanging)}
                  style={{
                    border:`1px solid ${active ? plan.color : '#CBD5E1'}`,
                    background: active ? plan.color : 'white',
                    color: active ? 'white' : '#334155',
                    borderRadius:10,
                    padding:'9px 6px',
                    fontSize:12,
                    fontWeight:700,
                    cursor: active || testPlanChanging ? 'default' : 'pointer'
                  }}
                >
                  {testPlanChanging === plan.id ? ui.common.loading : plan.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Plans */}
      <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
        {plans.map(plan => {
          const isCurrent = currentPlan === plan.id
          const isHighlighted = plan.highlighted
          const features = !nativeIOS && plan.founder && plan.founderFeature && remaining > 0
            ? [...plan.features, plan.founderFeature]
            : plan.features

          return (
            <div key={plan.id} style={{
              border: isHighlighted ? `2px solid ${plan.color}` : '1px solid #eee',
              borderRadius:16,
              overflow:'hidden',
              position:'relative',
              background:'white'
            }}>
              {isHighlighted && (
                <div style={{background:plan.color,padding:'6px',textAlign:'center'}}>
                  <span style={{color:'white',fontSize:12,fontWeight:600}}>
                    {nativeIOS ? ui.pricing.recommendedPlain : ui.pricing.recommended}
                  </span>
                </div>
              )}

              <div style={{padding:'1.25rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.75rem'}}>
                  <div>
                    <h3 style={{fontSize:18,fontWeight:700,color:plan.color,margin:0}}>{plan.name}</h3>
                    {isCurrent && (
                      <span style={{fontSize:11,color:'white',background:'#22c55e',padding:'2px 8px',borderRadius:20,fontWeight:600}}>
                        Plan actuel
                      </span>
                    )}
                  </div>
                  <div style={{textAlign:'right'}}>
                    {plan.price === 0 ? (
                      <p style={{fontSize:22,fontWeight:700,margin:0,color:'#444'}}>{ui.common.free}</p>
                    ) : (
                      <>
                        <p style={{fontSize:22,fontWeight:700,margin:0,color:'#1a1a1a'}}>
                          {getPriceLabel(plan)}
                          <span style={{fontSize:13,fontWeight:400,color:'#999'}}>{ui.common.month}</span>
                        </p>
                        {!nativeIOS && plan.founder && remaining > 0 && (
                          <p style={{fontSize:11,color:'#E24B4A',margin:'2px 0 0',fontWeight:600}}>
                            {ui.pricing.twoMonthsFree}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:'1rem'}}>
                  {features.map((f, i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:16,height:16,borderRadius:'50%',background:plan.color+'20',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{fontSize:10,color:plan.color}}>✓</span>
                      </div>
                      <span style={{fontSize:13,color:'#444'}}>{f}</span>
                    </div>
                  ))}
                  {(plan.limits || []).map((f, i) => (
                    <div key={`limit-${i}`} style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:16,height:16,borderRadius:'50%',background:'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{fontSize:10,color:'#999'}}>−</span>
                      </div>
                      <span style={{fontSize:13,color:'#777'}}>{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={plan.disabled || isCurrent || loading === plan.id}
                  style={{
                    width:'100%',padding:'12px',borderRadius:10,fontSize:14,fontWeight:600,cursor: plan.disabled || isCurrent ? 'default' : 'pointer',
                    background: isCurrent ? '#f0fdf4' : plan.disabled ? '#f5f5f5' : plan.color,
                    color: isCurrent ? '#22c55e' : plan.disabled ? '#999' : 'white',
                    border: isCurrent ? '1px solid #bbf7d0' : 'none'
                  }}>
                  {loading === plan.id ? ui.common.loading : isCurrent ? `✓ ${ui.common.currentPlan}` : plan.cta}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p style={{fontSize:11,color:'#999',textAlign:'center',marginTop:'1rem',lineHeight:1.5}}>
        {nativeIOS ? ui.pricing.appleFooter : ui.pricing.footer}
      </p>
      {nativeIOS && (
        <button onClick={handleRestorePurchases} disabled={restoring}
          style={{margin:'0.75rem auto 0',display:'block',background:'none',border:'none',color:'#E24B4A',fontSize:13,fontWeight:600,cursor:restoring ? 'default' : 'pointer'}}>
          {restoring ? ui.common.loading : ui.pricing.restorePurchases}
        </button>
      )}
    </div>
  )
}
