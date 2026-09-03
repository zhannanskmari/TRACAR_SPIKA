import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
            <span className="text-xl font-black tracking-tight text-white">С</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
            SPIKA<span className="text-blue-600">_</span>OFIS
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Трекер задач бухгалтерской фирмы
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
