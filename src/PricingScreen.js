import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    color: '#666',
    features: [
      'Profil entreprise',
      '5 swipes par jour',
      'Visible sur la carte',
      'Mode visiteur',
    ],
    cta: 'Plan actuel',
    disabled: true
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 19,
    color: '#185FA5',
    priceId: process.env.REACT_APP_STRIPE_PRICE_BASIC,
    features: [
      'Swipes illimités',
      'Messagerie B2B',
      'Visible sur la carte',
      'Statistiques de base',
    ],
    cta: 'Choisir Basic',
    disabled: false
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 39,
    color: '#E24B4A',
    priceId: process.env.REACT_APP_STRIPE_PRICE_PREMIUM,
    features: [
      'Tout Basic inclus',
      'Badge Membre Fondateur ⭐',
      'Visibilité prioritaire',
      'Accès anticipé nouveautés',
      '2 mois offerts — offre fondateurs',
    ],
    cta: 'Choisir Premium',
    disabled: false,
    highlighted: true,
    founder: true
  }
]

export default function PricingScreen({ user, setActiveTab }) {
  const [currentPlan, setCurrentPlan] = useState('starter')
  const [loading, setLoading] = useState(null)
  const [founderSlots, setFounderSlots] = useState({ used: 0, max: 100 })

  useEffect(() => {
    loadCurrentPlan()
    loadFounderSlots()
  }, [])

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

  const handleSubscribe = async (plan) => {
  if (plan.disabled || currentPlan === plan.id) return
  setLoading(plan.id)

  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId: plan.priceId,
          userId: user.id,
          planName: plan.id,
        }),
      }
    )

    const { url, error } = await response.json()
    if (error) throw new Error(error)
    
    // Rediriger vers Stripe Checkout
    window.location.href = url

  } catch (e) {
    alert('Une erreur est survenue : ' + e.message)
  }
  setLoading(null)
}

  const remaining = founderSlots.max - founderSlots.used

  return (
    <div style={{flex:1,overflowY:'auto',padding:'1.5rem 1rem'}}>

      <div style={{textAlign:'center',marginBottom:'1.5rem'}}>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:8}}>Choisissez votre plan</h2>
        <p style={{fontSize:14,color:'#666'}}>Développez votre réseau B2B en Suisse</p>
      </div>

      {/* Compteur fondateurs */}
      <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'0.875rem',marginBottom:'1.25rem',textAlign:'center'}}>
        <p style={{fontSize:13,color:'#E24B4A',fontWeight:600,margin:0}}>
          🎉 Offre Fondateurs — {remaining} places restantes sur 100
        </p>
        <div style={{background:'#fee2e2',borderRadius:8,overflow:'hidden',height:6,margin:'8px 0 4px'}}>
          <div style={{height:'100%',background:'#E24B4A',width:`${(founderSlots.used/founderSlots.max)*100}%`,borderRadius:8}} />
        </div>
        <p style={{fontSize:12,color:'#666',margin:0}}>2 mois Premium offerts pour les 100 premiers</p>
      </div>

      {/* Plans */}
      <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
        {plans.map(plan => {
          const isCurrent = currentPlan === plan.id
          const isHighlighted = plan.highlighted

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
                    ⭐ RECOMMANDÉ — OFFRE FONDATEURS
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
                      <p style={{fontSize:22,fontWeight:700,margin:0,color:'#444'}}>Gratuit</p>
                    ) : (
                      <>
                        <p style={{fontSize:22,fontWeight:700,margin:0,color:'#1a1a1a'}}>
                          CHF {plan.price}
                          <span style={{fontSize:13,fontWeight:400,color:'#999'}}>/mois</span>
                        </p>
                        {plan.founder && remaining > 0 && (
                          <p style={{fontSize:11,color:'#E24B4A',margin:'2px 0 0',fontWeight:600}}>
                            2 mois offerts !
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:'1rem'}}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:16,height:16,borderRadius:'50%',background:plan.color+'20',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{fontSize:10,color:plan.color}}>✓</span>
                      </div>
                      <span style={{fontSize:13,color:'#444'}}>{f}</span>
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
                  {loading === plan.id ? 'Chargement...' : isCurrent ? '✓ Plan actuel' : plan.cta}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p style={{fontSize:11,color:'#999',textAlign:'center',marginTop:'1rem',lineHeight:1.5}}>
        Résiliable à tout moment · Paiement sécurisé · CHF uniquement
      </p>
    </div>
  )
}