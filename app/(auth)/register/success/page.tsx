import Link from 'next/link';

export default function RegisterSuccessPage() {
    return (
        <div style={{ maxWidth: '480px', margin: '5rem auto', padding: '3rem', textAlign: 'center', border: '1px solid #ccc', borderRadius: '10px', fontFamily: 'inherit' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '1.2rem', color: '#16a34a' }}>
                Registration Successful!
            </h1>
            <p style={{ marginBottom: '2rem', color: '#000000', fontSize: '1.15rem', lineHeight: '1.6' }}>
                Your account has been successfully created. You can now log in using your credentials.
            </p>
            <Link
                href="/login"
                style={{
                    display: 'inline-block',
                    padding: '1rem 2rem',
                    backgroundColor: '#0070f3',
                    color: '#fff',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '1.1rem'
                }}
            >
                Go to Login
            </Link>
        </div>
    );
}