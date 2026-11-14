import sys; sys.path.insert(0, 'src')
import asyncio
from argus.core.db import Database

async def verify():
    db = Database('data/argus.db')
    await db.connect()
    row = await db.fetch_one(
        "SELECT sql FROM sqlite_master WHERE name='discovered_urls'"
    )
    print("discovered_urls DDL:")
    print(row['sql'])
    print()
    row2 = await db.fetch_one(
        "SELECT sql FROM sqlite_master WHERE name='search_queries'"
    )
    print("search_queries DDL:")
    print(row2['sql'])
    await db.disconnect()

asyncio.run(verify())
