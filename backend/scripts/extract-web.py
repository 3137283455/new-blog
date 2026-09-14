"""Offline extraction worker: stdin HTML envelope -> stdout JSON, no network."""
import json
import sys
import trafilatura

def main():
    payload = json.load(sys.stdin)
    options = dict(include_comments=False, include_images=True,
                   include_links=True, include_tables=True, include_formatting=True)
    html = trafilatura.extract(payload['html'], url=payload['url'],
                               output_format='html', **options)
    if not html:
        raise ValueError('没有提取到正文；网页可能需要登录或浏览器渲染')
    meta = trafilatura.extract_metadata(payload['html'], default_url=payload['url'])
    data = meta.as_dict() if meta else {}
    json.dump(dict(html=html, title=data.get('title') or '',
                   author=data.get('author') or '', date=data.get('date') or '',
                   description=data.get('description') or ''), sys.stdout, ensure_ascii=False)

if __name__ == '__main__':
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
