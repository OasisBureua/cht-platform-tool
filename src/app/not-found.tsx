import { Button, Eyebrow } from "@/components/ui";

export default function NotFound() {
 return (
 <section className="shell grid place-items-center py-28 text-center">
 <Eyebrow>404</Eyebrow>
 <h1 className="display display-tight mt-4 max-w-[540px] text-[2.25rem] text-text">
 That session is not in the library.
 </h1>
 <div className="mt-8 flex flex-wrap justify-center gap-4">
 <Button href="/latest">Browse the latest</Button>
 <Button href="/disease" variant="outline">
 Pick a tumor track
 </Button>
 </div>
 </section>
 );
}
