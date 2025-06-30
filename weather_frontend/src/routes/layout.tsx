import { component$, Slot, useStyles$ } from "@builder.io/qwik";
import styles from "./styles.css?inline";

// Layout: minimalist, wraps page with consistent header/footer if desired.
export default component$(() => {
  useStyles$(styles);
  return (
    <>
      <main>
        <Slot />
      </main>
    </>
  );
});
