import httpx
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}

with httpx.Client(headers=headers, follow_redirects=True) as client:
    # 1. Bing
    try:
        r = client.get('https://www.bing.com/search?q=Oswan+Yunus')
        print('Bing status:', r.status_code)
        links = re.findall(r'<li class="b_algo".*?h2><a href="([^"]+)"', r.text)
        print('Bing links:', len(links))
        for l in links[:3]:
            print('  Bing:', l)
    except Exception as e:
        print('Bing error:', e)

    # 2. Direct Profile Probing (GitHub, etc)
    try:
        gh = client.get('https://api.github.com/users/oswan-yunus')
        print('GitHub status:', gh.status_code)
        if gh.status_code == 200:
            print('  GitHub user found:', gh.json().get('html_url'), gh.json().get('name'))
    except Exception as e:
        print('GitHub error:', e)
