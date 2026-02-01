export default function Home() {
  return (
    <main style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
        Hello World!
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#666' }}>
        My first Next.js app deployed on Vercel
      </p>
    </main>
  );
}