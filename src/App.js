import React, { useState, useEffect } from 'react'

export default function App() {
  const [status, setStatus] = useState('démarrage...')
  
  useEffect(() => {
    setStatus('useEffect OK')
  }, [])

  return (
    <div style={{padding:40, fontSize:20, color:'black', background:'white'}}>
      Status: {status}
    </div>
  )
}