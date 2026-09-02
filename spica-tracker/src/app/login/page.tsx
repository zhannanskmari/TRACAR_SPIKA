import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Спика</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Трекер задач бухгалтерской фирмы
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
