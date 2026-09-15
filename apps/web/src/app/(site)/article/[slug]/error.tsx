'use client';

export default function ArticleError({ reset }: { reset: () => void }) {
  return (
    <section className="ryu-card mx-auto my-12 w-full max-w-xl p-8 text-center" role="alert">
      <h1 className="text-2xl font-bold">文章暂时无法加载</h1>
      <p className="my-4 text-sm opacity-65">请求未能完成，不代表文章已被删除。请稍后重试。</p>
      <div className="flex justify-center gap-3">
        <button type="button" className="ryu-btn-primary" onClick={reset}>
          重新加载
        </button>
        <a className="ryu-btn" href="/archive">
          返回文章列表
        </a>
      </div>
    </section>
  );
}
