export function LoginPanel() {
  return (
    <section id="login-panel" className="admin-panel">
      <div className="mx-auto max-w-md">
        <div className="ryu-card p-6">
          <h2 className="text-2xl font-black">登录后台</h2>

          <form id="login-form" className="mt-6 grid gap-4">
            <label className="form-control">
              <span className="label-text">用户名</span>
              <input
                className="input input-bordered rounded-xl"
                name="username"
                autoComplete="username"
                placeholder="admin"
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">密码</span>
              <input
                className="input input-bordered rounded-xl"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="请输入密码"
                required
              />
            </label>
            <button className="ryu-btn-primary" type="submit">
              登录并连接 API
            </button>
            <p id="login-message" className="min-h-6 text-sm text-error"></p>
          </form>
        </div>
      </div>
    </section>
  );
}
