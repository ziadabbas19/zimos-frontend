import { Link } from "react-router-dom";
import { buttonVariants } from "@store-builder/ui";
import { EmptyBlock } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";
import { useLandingPath } from "@/lib/nav";

export function NotFoundPage() {
  const landing = useLandingPath();
  return (
    <div>
      <PageHeader title="Page not found" />
      <EmptyBlock
        message="There's nothing at this address in the admin console."
        action={
          landing && (
            <Link to={landing} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to the console
            </Link>
          )
        }
      />
    </div>
  );
}
