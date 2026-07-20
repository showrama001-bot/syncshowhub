import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <header className="mb-12">
          <p className="uppercase tracking-[0.4em] text-xs text-muted-foreground mb-3">Legal</p>
          <h1 className="font-display text-4xl md:text-5xl tracking-widest neon-text mb-4">
            Terms & Privacy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </header>

        <article className="prose prose-invert max-w-none space-y-10 text-foreground/90 leading-relaxed">
          <section id="terms">
            <h2 className="font-display text-2xl tracking-wider mb-4 text-primary">Terms of Service</h2>
            <p className="text-sm">
              Welcome to SyncShow. By creating an account or using the platform, you agree to the
              terms below. If you do not agree, please do not use the service.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">1. User Accounts & Conduct</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>You must provide accurate information when creating an account and are responsible for keeping your credentials secure.</li>
              <li>You may not upload, stream, or share content you do not own or have the rights to distribute. Illegal, pirated, or copyrighted material is strictly prohibited.</li>
              <li>Watch rooms and chat are community spaces — treat other members with respect. Harassment, hate speech, threats, sexually explicit content involving minors, and spam are not tolerated.</li>
              <li>Attempts to bypass security, scrape the platform, extract stream URLs, or disrupt service are prohibited and may result in an immediate ban.</li>
              <li>We may suspend or terminate accounts that violate these rules at our sole discretion.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">2. Content Ownership & Disclaimer</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>All trademarks, film posters, artwork, and titles remain the property of their respective owners. SyncShow does not claim ownership of third-party content.</li>
              <li>User-submitted content (comments, reels, uploads) remains owned by the user, who grants SyncShow a non-exclusive license to display it on the platform.</li>
              <li>SyncShow is provided "as is" without warranties of any kind. We do not guarantee uninterrupted service, availability of any specific title, or the accuracy of third-party metadata.</li>
              <li>We are not liable for content shared by users or embedded from third-party providers. Report abusive or infringing material through the in-app report tools.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">3. Rooms, Streaming & Community</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Room hosts control playback and may remove participants who violate community standards.</li>
              <li>Voice, video, and chat features are intended for legitimate co-watching. Recording other participants without consent is prohibited.</li>
              <li>Live streamers are responsible for the content they broadcast and must comply with all applicable laws.</li>
            </ul>
          </section>

          <section id="privacy" className="pt-4">
            <h2 className="font-display text-2xl tracking-wider mb-4 text-primary">Privacy Policy</h2>
            <p className="text-sm">
              Your privacy matters. This section explains what we collect, how we use it, and the
              controls you have over your data.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">4. Data We Collect</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li><strong>Account data:</strong> email, username, display name, avatar, and authentication identifiers.</li>
              <li><strong>Activity data:</strong> watch history, watchlist, reactions, comments, and room participation used to power features like recommendations and stats.</li>
              <li><strong>Technical data:</strong> device fingerprint, IP address, and browser info used for security, rate limiting, and abuse prevention.</li>
              <li>We do not sell your personal data to third parties.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">5. How We Use Your Data</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Operate core features: authentication, watch rooms, DMs, uploads, and playback sync.</li>
              <li>Protect the platform from abuse, spam, and unauthorized access.</li>
              <li>Improve the experience by understanding aggregate usage patterns.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">6. Data Security</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Data is stored on our managed backend with row-level security policies restricting access to authorized users.</li>
              <li>Passwords are never stored in plaintext, and sensitive fields (like room passwords) are hashed.</li>
              <li>Access to admin surfaces is protected by role-based checks and obfuscated routes.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">7. Your Rights</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>You may request deletion of your account and associated personal data at any time from your profile settings or by contacting support.</li>
              <li>You may update or correct your profile information yourself in-app.</li>
              <li>You may opt out of non-essential communications while continuing to use the service.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">8. Changes to These Terms</h3>
            <p className="text-sm">
              We may update these terms as the platform evolves. Material changes will be surfaced
              in-app. Continued use of SyncShow after an update constitutes acceptance of the
              revised terms.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">9. Contact</h3>
            <p className="text-sm">
              Questions, DMCA notices, or privacy requests can be sent through the in-app report
              tools or your account's support channel.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}