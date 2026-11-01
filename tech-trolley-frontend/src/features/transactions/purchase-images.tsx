"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Camera } from "lucide-react";
import { FormField, FormGrid } from "@/components/forms/form-field";
import { useShop } from "@/contexts/shop-context";
import { api, apiBase } from "@/services/api";

export type PurchasePhoto = {
  id: string;
  purpose: "memo" | "nidFront" | "nidBack";
};
export const photoCopy = (bn: boolean) => ({
  memo: bn ? "ক্রয়ের মেমো" : "Purchase memo",
  nidFront: bn ? "বিক্রেতার NID · সামনের ছবি" : "Seller NID · front",
  nidBack: bn ? "বিক্রেতার NID · পেছনের ছবি" : "Seller NID · back",
  camera: bn ? "ক্যামেরায় ছবি তুলুন" : "Take photo",
  view: bn ? "বড় করে দেখুন" : "View photo",
  download: bn ? "ডাউনলোড" : "Download",
  remove: bn ? "সরান" : "Remove",
  retry: bn ? "আবার চেষ্টা" : "Retry",
  help: bn
    ? "ছবি ঐচ্ছিক। JPEG/PNG/WebP নিন। বড় ছবি ছোট করে সংরক্ষণ হবে; লেখাগুলো পরিষ্কার আছে কি না দেখুন।"
    : "Photos are optional. Use JPEG/PNG/WebP. Large images are reduced; check that the writing remains readable.",
  preparing: bn
    ? "ছবি প্রস্তুত ও upload হচ্ছে…"
    : "Preparing and uploading photo…",
  unavailable: bn
    ? "ছবির সুবিধা প্রস্তুত হচ্ছে; ছবি ছাড়া purchase করা যাবে।"
    : "Photos are not ready yet; purchases can be saved without photos.",
  failed: bn
    ? "ছবি সংরক্ষণ হয়নি। আবার চেষ্টা করুন বা ছবিটি সরান। iPhone-এ ছবি না খুললে JPEG/PNG বেছে নিন।"
    : "Photo not saved. Retry or remove it. If an iPhone photo cannot be opened, choose JPEG/PNG.",
  full: bn
    ? "ছবির জায়গা/সীমা পূর্ণ হয়েছে। ছবি সরিয়ে purchase করা যাবে; মালিককে জানান।"
    : "Photo storage/upload limit reached. Remove the selected photo to continue without it; contact the Owner.",
  saved: bn
    ? "Purchase সংরক্ষিত হয়েছে; শুধু ছবি যুক্ত করা বাকি। Retry করলে আরেকটি purchase হবে না।"
    : "Purchase is saved; only photo linking remains. Retry will not create another purchase.",
  closeSaved: bn ? "ছবি ছাড়া এগিয়ে যান" : "Continue without photos",
  linkRetry: bn ? "শুধু ছবি যুক্ত করার চেষ্টা করুন" : "Retry linking photos",
  history: bn ? "সরানোর ইতিহাস" : "Removal history",
  empty: bn ? "কোনো ছবি যুক্ত নেই।" : "No photos attached.",
  title: bn ? "ক্রয়ের সংযুক্ত ছবি" : "Purchase photos",
  limit: bn
    ? "ছবির সর্বোচ্চ সংখ্যা পূর্ণ হয়েছে।"
    : "Maximum number of photos reached.",
});
const photoUrl = (id: string, download = false) =>
  `${apiBase}/purchases/files/${encodeURIComponent(id)}${download ? "?download=1" : ""}`;
async function prepareImage(file: File): Promise<Blob> {
  if (
    file.size > 25 * 1024 * 1024 ||
    (file.type && !file.type.startsWith("image/"))
  )
    throw Error("IMAGE_INVALID");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 80_000_000
    )
      throw Error("IMAGE_INVALID");
    const scale = Math.min(
      1,
      2200 / image.naturalWidth,
      3000 / image.naturalHeight,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("IMAGE_INVALID");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.78, 0.65, 0.5, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= 512 * 1024) return blob;
    }
    throw Error("IMAGE_TOO_LARGE");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function PurchasePhotoFields({
  individual,
  images,
  setImages,
  disabled = false,
  onBusy,
  onProblem,
  existing = [],
}: {
  individual: boolean;
  images: PurchasePhoto[];
  setImages: Dispatch<SetStateAction<PurchasePhoto[]>>;
  disabled?: boolean;
  onBusy: (v: boolean) => void;
  onProblem: (v: boolean) => void;
  existing?: PurchasePhoto[];
}) {
  const { lang } = useShop(),
    bn = lang === "bn",
    copy = photoCopy(bn);
  const [ready, setReady] = useState(false),
    [configAttempt, setConfigAttempt] = useState(0),
    [working, setWorking] = useState(false),
    [failed, setFailed] = useState<
      {
        id: string;
        purpose: PurchasePhoto["purpose"];
        file: File;
        blob?: Blob;
        message: string;
      }[]
    >([]),
    [message, setMessage] = useState("");
  const alive = useRef(true),
    controllers = useRef(new Set<AbortController>());
  useEffect(() => {
    alive.current = true;
    void api
      .request<{ enabled: boolean }>("/purchases/attachments-config")
      .then((r) => {
        if (alive.current) setReady(r.enabled);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
      for (const c of controllers.current) c.abort();
      onBusy(false);
      onProblem(false);
    };
  }, [onBusy, onProblem, configAttempt]);
  useEffect(() => onProblem(failed.length > 0), [failed, onProblem]);
  async function upload(row: {
    id: string;
    purpose: PurchasePhoto["purpose"];
    file: File;
    blob?: Blob;
  }) {
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const blob = row.blob || (await prepareImage(row.file));
      row.blob = blob;
      const response = await fetch(
        `${apiBase}/purchases/files/${row.id}?purpose=${row.purpose}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "image/jpeg" },
          body: blob,
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(35000),
          ]),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Error(body.code || "IMAGE_INVALID");
      }
      if (alive.current) {
        setImages((v) =>
          v.some((i) => i.id === row.id)
            ? v
            : [...v, { id: row.id, purpose: row.purpose }],
        );
        setFailed((v) => v.filter((i) => i.id !== row.id));
      }
    } catch (error) {
      if (alive.current) {
        const code = (error as Error).message;
        setFailed((v) => [
          ...v.filter((i) => i.id !== row.id),
          {
            ...row,
            message: ["IMAGE_STORAGE_FULL", "IMAGE_UPLOAD_LIMIT"].includes(code)
              ? copy.full
              : copy.failed,
          },
        ]);
      }
    } finally {
      controllers.current.delete(controller);
    }
  }
  async function choose(
    files: FileList | null,
    purpose: PurchasePhoto["purpose"],
  ) {
    if (!files?.length || working || disabled) return;
    const limit = purpose === "memo" ? 4 : 1,
      count = [...images, ...failed, ...existing].filter(
        (i) => i.purpose === purpose,
      ).length;
    if (files.length + count > limit) {
      setMessage(copy.limit);
      return;
    }
    setMessage("");
    setWorking(true);
    onBusy(true);
    try {
      for (const file of Array.from(files))
        await upload({ id: crypto.randomUUID(), purpose, file });
    } finally {
      if (alive.current) {
        setWorking(false);
        onBusy(false);
      }
    }
  }
  return (
    <section className="purchase-photo-fields">
      <p className="field-hint">{copy.help}</p>
      {!ready && (
        <p role="status" className="field-hint">
          {copy.unavailable}{" "}
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => setConfigAttempt((v) => v + 1)}
          >
            {copy.retry}
          </button>
        </p>
      )}
      <FormGrid>
        {(individual
          ? (["nidFront", "nidBack"] as const)
          : (["memo"] as const)
        ).map((purpose) => (
          <PhotoPicker
            key={purpose}
            purpose={purpose}
            copy={copy}
            bn={bn}
            disabled={
              disabled ||
              working ||
              !ready ||
              [...images, ...existing, ...failed].filter(
                (i) => i.purpose === purpose,
              ).length >= (purpose === "memo" ? 4 : 1)
            }
            onChoose={(files) => void choose(files, purpose)}
          />
        ))}
      </FormGrid>
      {working && <p role="status">{copy.preparing}</p>}
      {message && (
        <p role="status" className="field-error">
          {message}
        </p>
      )}
      {images.length > 0 && (
        <div className="purchase-photo-previews">
          {images.map((i) => (
            <article key={i.id}>
              <p>{copy[i.purpose]}</p>
              <img
                src={photoUrl(i.id)}
                alt={copy[i.purpose]}
                width={160}
                height={100}
              />
              <div>
                <a
                  className="text-button"
                  href={photoUrl(i.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {copy.view}
                </a>
                <button
                  type="button"
                  className="text-button"
                  disabled={disabled || working}
                  onClick={() =>
                    setImages((v) => v.filter((x) => x.id !== i.id))
                  }
                >
                  {copy.remove}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {failed.map((row) => (
        <div key={row.id} className="notice" role="alert">
          <p>{row.message}</p>
          <button
            type="button"
            className="button"
            disabled={disabled || working}
            onClick={async () => {
              setWorking(true);
              onBusy(true);
              try {
                await upload(row);
              } finally {
                if (alive.current) {
                  setWorking(false);
                  onBusy(false);
                }
              }
            }}
          >
            {copy.retry}
          </button>{" "}
          <button
            type="button"
            className="button"
            disabled={disabled || working}
            onClick={() => setFailed((v) => v.filter((i) => i.id !== row.id))}
          >
            {copy.remove}
          </button>
        </div>
      ))}
    </section>
  );
}
function PhotoPicker({
  purpose,
  copy,
  bn,
  disabled,
  onChoose,
}: {
  purpose: PurchasePhoto["purpose"];
  copy: ReturnType<typeof photoCopy>;
  bn: boolean;
  disabled: boolean;
  onChoose: (files: FileList | null) => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  return (
    <FormField
      label={copy[purpose]}
      optional
      optionalText={bn ? "ঐচ্ছিক" : "Optional"}
      action={
        <>
          <button
            type="button"
            className="text-button photo-camera"
            disabled={disabled}
            onClick={() => camera.current?.click()}
          >
            <Camera size={16} />
            {copy.camera}
          </button>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={disabled}
            aria-label={`${copy[purpose]} · ${copy.camera}`}
            onChange={(e) => {
              onChoose(e.target.files);
              e.target.value = "";
            }}
          />
        </>
      }
    >
      <input
        type="file"
        accept="image/*"
        multiple={purpose === "memo"}
        disabled={disabled}
        onChange={(e) => {
          onChoose(e.target.files);
          e.target.value = "";
        }}
      />
    </FormField>
  );
}
export function PurchaseImages({
  id,
  individual,
}: {
  id: string;
  individual: boolean;
}) {
  const { lang } = useShop(),
    copy = photoCopy(lang === "bn");
  const [items, setItems] = useState<
      (PurchasePhoto & {
        removed_at?: string;
        removed_by?: string;
        uploaded_by: string;
        created_at: string;
      })[]
    >([]),
    [images, setImages] = useState<PurchasePhoto[]>([]),
    [busy, setBusy] = useState(false),
    [problem, setProblem] = useState(false),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    void api
      .request<{ images: typeof items }>(`/purchases/${id}/attachments`)
      .then((r) => {
        if (live) {
          setItems(r.images);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (live) setError(copy.failed);
      });
    return () => {
      live = false;
    };
  }, [id]);
  async function refresh() {
    const r = await api.request<{ images: typeof items }>(
      `/purchases/${id}/attachments`,
    );
    setItems(r.images);
  }
  return (
    <section className="purchase-images">
      <h3>{copy.title}</h3>
      {!items.length && loaded && <p className="muted">{copy.empty}</p>}
      {items.map((i) => (
        <div className="purchase-photo-saved" key={i.id}>
          <div>
            <b>{copy[i.purpose]}</b>
            <small>
              {i.uploaded_by} ·{" "}
              {new Date(i.created_at).toLocaleString(
                lang === "bn" ? "bn-BD" : "en-GB",
                { timeZone: "Asia/Dhaka" },
              )}
              {i.removed_at
                ? ` · ${copy.history}: ${i.removed_by || ""} · ${new Date(i.removed_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}`
                : ""}
            </small>
          </div>
          <a
            className="text-button"
            href={photoUrl(i.id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy.view}
          </a>
          <a className="text-button" href={photoUrl(i.id, true)}>
            {copy.download}
          </a>
          {!i.removed_at && (
            <button
              className="text-button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setError("");
                try {
                  await api.request(
                    `/purchases/${id}/attachments/${i.id}/remove`,
                    "POST",
                    {},
                  );
                  await refresh();
                } catch {
                  setError(copy.failed);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {copy.remove}
            </button>
          )}
        </div>
      ))}
      {loaded && (
        <PurchasePhotoFields
          individual={individual}
          images={images}
          setImages={setImages}
          existing={items.filter((i) => !i.removed_at)}
          disabled={saving}
          onBusy={setBusy}
          onProblem={setProblem}
        />
      )}
      {images.length > 0 && (
        <button
          className="button primary"
          disabled={saving || busy || problem}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await api.request(`/purchases/${id}/attachments`, "POST", {
                ids: images.map((i) => i.id),
              });
              setImages([]);
              await refresh();
            } catch {
              setError(copy.failed);
            } finally {
              setSaving(false);
            }
          }}
        >
          {lang === "bn" ? "ছবি সংরক্ষণ করুন" : "Save photos"}
        </button>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}
