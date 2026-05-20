export default function LoadingIndicator({
  label = 'Chargement...',
  fullScreen = false,
  height = 260,
  background = 'transparent',
  compact = false,
  style = {},
}) {
  const logoSize = compact ? 40 : 52
  const dotSize = compact ? 4 : 5

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        width: '100%',
        height: fullScreen ? '100dvh' : height,
        minHeight: compact ? 120 : Math.min(height, 220),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 9 : 12,
        background,
        fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        ...style,
      }}
    >
      <style>{`
        @keyframes hubbingLoaderFloat {
          0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 12px 28px rgba(226,75,74,0.18); }
          50% { transform: translateY(-3px) scale(1.035); box-shadow: 0 16px 34px rgba(226,75,74,0.24); }
        }
        @keyframes hubbingLoaderHalo {
          0%, 100% { opacity: 0.22; transform: scale(0.86); }
          50% { opacity: 0.42; transform: scale(1.08); }
        }
        @keyframes hubbingLoaderDot {
          0%, 80%, 100% { opacity: 0.28; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>

      <div style={{position:'relative',width:logoSize + 20,height:logoSize + 20,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span
          aria-hidden="true"
          style={{
            position:'absolute',
            inset:0,
            borderRadius:'50%',
            background:'rgba(226,75,74,0.14)',
            animation:'hubbingLoaderHalo 1.9s ease-in-out infinite',
          }}
        />
        <div
          style={{
            width:logoSize,
            height:logoSize,
            borderRadius:'50%',
            background:'white',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            border:'1px solid rgba(226,75,74,0.12)',
            animation:'hubbingLoaderFloat 1.9s ease-in-out infinite',
          }}
        >
          <img src="/LOGO-HUBBING.svg" alt="" aria-hidden="true" style={{width:logoSize,height:logoSize,borderRadius:'50%',display:'block'}} />
        </div>
      </div>

      {label && (
        <p style={{margin:0,color:'#8A8F98',fontSize:compact ? 12 : 13,fontWeight:700,letterSpacing:0}}>
          {label}
        </p>
      )}

      <div aria-hidden="true" style={{display:'flex',alignItems:'center',gap:5,height:8}}>
        {[0, 1, 2].map(index => (
          <span
            key={index}
            style={{
              width:dotSize,
              height:dotSize,
              borderRadius:'50%',
              background:'#E24B4A',
              animation:'hubbingLoaderDot 1.2s ease-in-out infinite',
              animationDelay:`${index * 0.16}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
