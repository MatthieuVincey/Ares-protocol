import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Capture console messages
        page.on("console", lambda msg: print(f"CONSOLE [{msg.type}]: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        
        print("Navigating to http://localhost:8000 ...")
        await page.goto("http://localhost:8000")
        
        print("Waiting 1 second...")
        await page.wait_for_timeout(1000)
        
        print("Clicking start button...")
        try:
            await page.click("#start-btn")
            print("Clicked!")
        except Exception as e:
            print("Could not click start-btn:", e)
            
        print("Waiting 2 seconds for gameplay...")
        await page.wait_for_timeout(2000)
        
        # Evaluate to get player pos
        pos = await page.evaluate("state.player.pos")
        print("Final Player Pos:", pos)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
