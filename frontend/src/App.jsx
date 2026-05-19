import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Summary from './components/Summary'
import ChatBox from './components/ChatBox'
import LoginModal from './components/LoginModal'

export default function App() {
  const [showLogin, setShowLogin] = useState(false)

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar onLoginClick={() => setShowLogin(true)} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Summary />
        <ChatBox />
      </main>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
