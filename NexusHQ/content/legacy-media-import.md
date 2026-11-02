# Legacy portfolio media import

Imported at the user's request on 20 October 2026.

- Source: `personalproject-Abiali-Portfolio/static`.
- Destination: the existing public Supabase Storage `portfolio` bucket, under `legacy-20261020/`.
- 230 original files, 513,632,054 bytes. Manifest includes source paths, destination paths, MIME types, sizes and SHA-256 checksums.
- Profile now links `MyImage.jpg` as its portrait and the existing `AbialiCV.pdf` as its resume. The PDF is the original older document, not a rewritten CV.
- All 16 projects now have covers and ordered galleries: 151 images and 40 videos. Logos and other thumbnails were also preserved in Storage.
- Wedfield keeps media from customer, admin, vendor and backend directories in one project. ZanaduHealth keeps its frontend and backend media together.
- Projects remain drafts. Gallery metadata follows the parent project's existing row-level security. The bucket retains its existing public-read behavior.
- Added the `projects.media` JSON array column, matching types, server coercion and an admin gallery control for previews, uploads, descriptions, reordering and removal.
- A temporary, expiring capability authenticated signer was restricted to the 230 exact destination paths. It issued signed upload tokens without exposing server credentials or using the browser session. After upload, it was replaced with a disabled HTTP 410 handler and JWT verification restored. Its local source is the disabled handler; no capability key is saved in the repository.
- The CLI bootstrap stalled; it was stopped. The database generated migration version `20261020145215`; the same SQL is saved locally.

Verification:
- All 230 Storage objects matched the manifest byte lengths.
- All 230 public URLs returned successful HEAD responses with matching MIME types and lengths.
- A video byte-range request returned HTTP 206 and the requested 1,024 bytes.
- All 16 database projects have a cover and nonempty gallery, and retain draft status.
- The database rejects non-array gallery values. Anonymous users cannot read draft projects.
- `npm run typecheck` passed for admin and API. No browser UI automation was available.

The security advisor reported existing notices for testimonial and event-trigger SECURITY DEFINER functions and disabled leaked-password protection; this migration added no functions or policies. Existing notices were left outside this media task. References: [function grants](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
