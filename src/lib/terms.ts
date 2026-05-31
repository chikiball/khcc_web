/**
 * Burkam member agreement — adapted from the structure of Strava's Terms of
 * Service (Jan 2026) and stripped to what actually fits a self-hosted
 * cycling-club tool: no payments, no advertising, no public profiles, no
 * live location tracking, no third-party integrations beyond Google sign-in.
 *
 * The full text is rendered on /terms; users must tick the consent box
 * before they can reach onboarding. The effective date below should be
 * bumped on any material change so we know whether to re-prompt members
 * (a future "you must re-accept the latest terms" flow can key off this).
 */

export const TERMS_EFFECTIVE_DATE = "2026-05-31";

export type TermsSection = { heading: string; body: string[] };

export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: "1. About this agreement",
    body: [
      "These terms govern your use of the Burkam (Bubur Kampung Cycling) member site at burkam.nandharu.uk. By ticking the box at the bottom of this page you agree to them. If you don't agree, don't use the site.",
      "Burkam is a private cycling group. The site is run by club volunteers, not a company. There is no fee, no subscription, no advertising, and your data is never sold.",
    ],
  },
  {
    heading: "2. Eligibility",
    body: [
      "You must be at least 18 years old to ride with Burkam and to use this site. Road cycling carries real risk of injury or death, and only adults can give the informed consent that participation requires.",
    ],
  },
  {
    heading: "3. Your account",
    body: [
      "Sign-in is via Google or by entering your email address. New members start with status \"pending\" and are reviewed by an admin before being approved. Approval is at the admin's discretion.",
      "You agree to provide accurate information and keep it up to date. One account per person. Don't share your sign-in. You are responsible for everything posted under your account.",
      "Admins may suspend or remove your access at any time — for example, if you breach these terms, behave unsafely on rides, or harass another member.",
    ],
  },
  {
    heading: "4. Information we collect",
    body: [
      "Account: your name, email address, profile photo (optional), bike, Strava handle (optional), short bio (optional), preferred pace group.",
      "Emergency contact: name and phone number of someone we should call if something happens to you on a ride. This is held in a separate, restricted table — see section 6.",
      "Activity: your RSVPs, any GPX route files you upload as a ride leader, and photos uploaded to the gallery.",
      "Technical: standard server logs (IP, user agent, timestamps) for security and abuse prevention.",
      "We do not track your live location. We do not collect health data, heart rate, or device sensor data. We do not use cookies for advertising.",
    ],
  },
  {
    heading: "5. How we use your information",
    body: [
      "To run the club: show you upcoming rides, let you RSVP, show ride leaders who's coming on their ride, send approval emails.",
      "To keep things safe: ride leaders see RSVPs for their ride; cross-pace leaders on the same ride can see each other's lists for emergencies.",
      "To keep records: past rides and your RSVPs are kept indefinitely so the club has a history. You can request deletion of your account at any time (see section 11).",
      "We never sell your information. We never share it with advertisers. We never share it with other clubs or third parties except where legally required.",
    ],
  },
  {
    heading: "6. Emergency contact details",
    body: [
      "Your emergency contact is shown only to ride leaders, organisers, and admins, and only on the detail page of rides you have RSVP'd to. Ordinary members never see it.",
      "Provide a contact who actually consents to being called in an emergency. By submitting their details you confirm you have their permission.",
    ],
  },
  {
    heading: "7. Cycling carries risk — you accept it",
    body: [
      "Road cycling is dangerous. Riders crash, get hit by vehicles, suffer mechanical failures, and are exposed to weather, traffic, and other road users.",
      "By joining a Burkam ride you accept all risks of cycling and agree that Burkam, its ride leaders, organisers, admins, and other members are NOT responsible for injury, death, property damage, or any other loss to you, your bike, or third parties arising from your participation.",
      "You are responsible for: your own fitness and skill level, the roadworthiness of your bike, wearing a helmet, riding within your limits, obeying road rules, and carrying your own insurance if you want it.",
      "Ride leaders volunteer their time. They are not professional guides, coaches, or medics. Their suggestions about pace, route, weather, or anything else are not professional advice.",
    ],
  },
  {
    heading: "8. Conduct",
    body: [
      "Be civil. No harassment, hate speech, discrimination, or threats — on the site, on rides, or in any related channel.",
      "Don't impersonate other people. Don't post anyone else's personal information without their consent. Don't spam.",
      "On rides: ride predictably, signal, communicate hazards, and don't take risks that endanger the group.",
    ],
  },
  {
    heading: "9. Content you upload",
    body: [
      "You keep ownership of anything you upload — your profile photo, gallery photos, GPX routes, descriptions you write.",
      "By uploading, you grant Burkam a non-exclusive, royalty-free licence to display that content within the member site for the purpose of running the club. We won't use your content outside that purpose. The licence ends when you delete the content (or your account).",
      "Don't upload anything you don't have the right to upload — copyrighted images, other people's photos without consent, etc.",
    ],
  },
  {
    heading: "10. Site availability",
    body: [
      "The site is run by volunteers on self-hosted infrastructure. We do our best to keep it up but make no guarantee of uptime, accuracy, or fitness for any purpose. Use it as-is.",
    ],
  },
  {
    heading: "11. Closing your account",
    body: [
      "You can ask an admin to delete your account at any time. We will remove your profile, emergency contact, RSVPs, and any photos you uploaded. Past rides remain in the history with your name removed.",
      "Some records (server logs, audit trail of admin actions) may be retained for up to 90 days for security and abuse handling.",
    ],
  },
  {
    heading: "12. Changes",
    body: [
      "We may update these terms when something material changes — for example, a new feature with new data implications. If we do, we'll prompt you to read and re-accept on your next sign-in.",
    ],
  },
  {
    heading: "13. Contact",
    body: [
      "Questions or requests: speak to a Burkam admin in person, or email hello@burkam.nandharu.uk.",
    ],
  },
];
