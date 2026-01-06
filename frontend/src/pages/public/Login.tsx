import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Sign in to CHT
        </h1>

        <p className="mt-1 text-sm text-gray-600">
          Access your educational activities and earnings.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            // TEMP: demo navigation
            navigate('/app/webinars');
          }}
        >
          <Input label="Email address" type="email" placeholder="jane@email.com" />
          <Input label="Password" type="password" placeholder="••••••••" />

          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Sign in
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Don’t have an account?
          </span>
          <Link to="/join" className="font-semibold text-gray-900 hover:underline">
            Join
          </Link>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  type = 'text',
  placeholder,
}: {
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      />
    </div>
  );
}
