"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h2>We couldn’t load this page</h2>
      <p>Your data hasn’t been changed. Try again in a moment.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
