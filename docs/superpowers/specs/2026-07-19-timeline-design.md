# Meeting Story Timeline — Design

Sub-project 6 of the wedding-invitation improvement plan. Scope: an admin-managed, ordered list of couple's-story milestones (date/title/text, optional photo), shown as a vertical timeline on the guest-facing site.

## Data model

New Firestore collection `timeline`, structurally identical to the existing `photos` collection (add-only from the admin's "새 항목 추가" form, delete + drag-reorder for management — no in-place edit, matching how `photos` already works):

```
timeline/{autoId}: {
  date: string,       // free text, e.g. "2023.05" or "2023년 5월" — admin's choice, not a strict date type
  title: string,
  text: string,
  imageUrl: string,   // optional — '' if no photo attached
  order: number,
  createdAt: serverTimestamp()
}
```

`firestore.rules` needs a new `timeline` match block mirroring `photos`: public read, authenticated write (add/delete), matching the existing collection's rule shape exactly.

## Admin UI

New collapsible panel "💕 만남 스토리" in `admin.html`, positioned after the existing "📸 사진 관리" panel (before "💳 계좌번호"), containing:

- **Add form:** 날짜 (text input), 제목 (text input), 본문 (textarea), 사진 업로드 (optional — same `upload-area` + Cloudinary flow already used for gallery photos), "추가" button. Clicking 추가 immediately writes a new `timeline` doc via `addDoc` (photo upload happens first if a file was selected, same sequencing as the existing gallery photo upload).
- **Existing items list:** rendered below the form, one row per item — thumbnail (if `imageUrl` set) + date/title/text preview + drag handle + delete button. Drag-to-reorder and delete work exactly like the existing photo grid (`_photoList`/`renderPhotoGrid`/`save-photo-order-btn` pattern — the timeline panel gets its own parallel `_timelineList`/`renderTimelineList`/a "💾 순서 저장" button, same mechanics, different Firestore collection).
- No inline editing of an existing item's date/title/text/photo — per explicit decision, delete-and-re-add is the correct scope, matching how photo management already works.

## Guest-facing display

New section `#timeline`, positioned in `index.html` right after the existing "5. 포토 갤러리" section and before "6. 방명록" — numbered "5.5. 만남 스토리" in the file's existing half-numbered comment convention (the same convention already used for "1.5. 인트로 멘트").

Vertical timeline layout: entries stacked top-to-bottom in `order`, each row showing a connector dot + vertical line (using the site's existing `--accent` bronze token for the dot/line color, matching how `--accent` is already used sparingly as "the one point of color" per the file's own comment on that token), then date (small, `--font-display` italic, matching how dates/labels are styled elsewhere on the site) + title + text, with the photo (if present) shown above or beside the text. If the `timeline` collection is empty, the whole section stays hidden (`display:none`), same pattern already used for the "1.5. 인트로 멘트" section when `introTitle`/`introText` are both unset.

## Out of scope

- No in-place editing of existing timeline entries (explicit decision — delete + re-add only).
- No date-type validation or calendar picker — `date` is a free-text field, admin's own formatting choice.
- No limit on the number of entries (same as photos — no artificial cap).
