![GovBlock](.github/readme/home.png)

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/nyd-user-1/govblock/pulls)

## GovBlock's open-source codebase and data

GovBlock is a public record of all legislation across all 52 US jurisdictions (Congress, the 50 states and the District of Columbia), stretching back nearly 20 years. It includes five specialist agents equipped with custom tools for discrete tasks; connectors for Discord, Slack, Google Drive, Calendar, Sheets and Docs; GovBlock's own workspace, modeled on GitHub repositories, commits and diffs; and two canvas views to hold reusable components and data. Compose a view across legislatures, sessions and topics, then take the code with you.

One view over all 50 states and Congress. Open Source. Open Code. Open Data.

## Table of Contents

- [The Record](#the-record)
- [The Agents](#the-agents)
- [Connectors](#connectors)
- [The Workspace](#the-workspace)
- [The Platform](#the-platform)
- [Reporting Bugs and Issues](#reporting-bugs-and-issues)
- [Reporting Security Issues and Responsible Disclosure](#reporting-security-issues-and-responsible-disclosure)
- [Contributing](#contributing)
- [License](#license)

### The Record

Pick a state or Congress from the flag in the header and every page follows. Every page says plainly when a jurisdiction's record is thinner than another's.

1. **Bills.** Every bill in all 52 jurisdictions, newest first.
   - What it does, its status, and the date of the last action
   - Sponsors with party and district
   - The full history, committee referrals and roll calls
   - Subjects, hearings and related bills
   - The text as filed, every version, and the changes between them
2. **Committees.** Who sits where, and what is before them.
   - The docket, and where each bill on it stands
   - The roster
   - The latest hearing, on video
3. **Members.** The sitting members, with party and district.
   - Bills sponsored and cosponsored
   - Every vote cast
   - For Congress, campaign finance by cycle
4. **Votes.** Every roll call, floor and committee, with each member's position.
5. **Finance.** Lobbying and campaign money, where the record holds it.
   - The lobbying filings that name a bill, and who filed them
   - Members' totals by cycle and their largest reported contributions
6. **Laws.** What passed, and the bill it began as.
7. **Nominations.** Nominations before the Senate.
8. **Reports.** Committee reports and Congressional Research Service research.
9. **The Record.** The Congressional Record, issue by issue.
10. **News.** What the legislature did, newest first: enacted, passed, in committee, introduced, the latest roll calls and the hearings ahead.
11. **Forms.** 48,684 government forms for benefits, grants and programs, each with its PDF.
12. **Search.** Members, bills and committees across every jurisdiction, and the full text of every bill. Press ⌘K anywhere.

### The Agents

Five specialists, named for the offices of a legislature. Each one answers only from the record it has read, cites the rows it read, and says when the record is thin instead of filling the gap.

- **Clerk.** A bill you need to understand before the meeting.
- **Parliamentarian.** Whose district, which committee, and where the bill is stuck.
- **Treasurer.** Who paid, who filed, and what the record leaves out.
- **Whip.** A topic you cannot watch every day. Give it a topic and a jurisdiction; it searches, reads each bill, writes a digest and posts it where you asked.
- **Librarian.** A question that needs a report, not an answer. It plans the sections, gathers the records, writes the report and delivers it.
- **Inbox.** Work you hand off and read when it is done. A task is a thread: send it, and the report comes back as a reply.

### Connectors

Send bills, votes and hearings where your team already works.

- **Google Drive.** Save a delivered report straight into your own Drive, as a document you own.
- **Google Calendar.** Put a hearing on your own calendar, with the committee, the time and the link back.
- **Google Docs.** A delivered report lands as a Google Doc you can edit, not a file you download.
- **Google Sheets.** Export the hearings you are looking at to a spreadsheet in your own Drive.
- **Slack.** Send a digest to a channel in your own workspace, under your own account.
- **Discord.** Where the Whip posts its digests and the Librarian delivers its reports.

Your connections are yours. Each is a grant to your own account that nobody else on the site can see or use.

### The Workspace

A legislature, browsed the way GitHub browses a repository. The jurisdiction is the organization, the session is the repository, and Bills, Committees, Members and Votes are its folders. A bill is a file. Its versions are its commits.

- **The tree.** Fifty-two organizations, twenty years of sessions each. Open a session and walk it: every bill, newest first; every committee with its docket, its roster and its calendar; every member; every roll call by month, floor and committee, down to how each member voted. The path over the table is the address. Copy it, and the link opens exactly here.
- **A bill as a file.** One uniform text view across every jurisdiction, with the legislature's own line numbers in the gutter, an outline of sections, folding, and search across this bill, this session or all of GovBlock. Raw, copy, download, jump to line, and GitHub's keyboard shortcuts.
- **Changes.** Every version diffed against the one before it, unified or side by side, the changed words marked, the unchanged context folded, and a comment on any line. The diff is GitHub's own, measured from github.com and rebuilt to the numbers.
- **History.** The versions as a commit list, each dated by the action in the record that produced it.
- **Fork and commit.** The legislature's text is never edited. Fork the bill, edit it, preview the diff, and commit with a message. Your commits sit beside the official versions and browse, diff and list like any of them. Forks are public, and yours have a folder of their own.
- **Presets.** The view you build (where you are in the tree, the filters, the design) is a six-character code. Save it, paste it, share it as a link, or take the code.
- **Design.** Eight shadcn styles, base colors, themes, chart colors, icon sets and radius for the cards, and the typeset set for the bill itself: faces, measure, size, leading and flow. Shuffle with locks on what you want to keep. Undo is the browser's back button.
- **Two canvases.** Blocks holds the composed surfaces this site is built from. Typeset sets a bill as a document. Both take the code.
- **Calendar.** Hearings and sessions by day, week and month.
- **Changelog.** What shipped, and when.

### The Platform

GovBlock is a Next.js site over one Postgres database, with Claude behind the agents. To run it:

```sh
git clone https://github.com/nyd-user-1/govblock.git
cd govblock
corepack enable
pnpm install
pnpm dev
```

You need Node 20 or newer. Without a database the site runs on the Congress data committed in the repository, so every page renders with no keys at all. To read a full record, point `POLICY_DATABASE_URL` in `apps/web/.env.local` at a Postgres database.

How the pieces fit together is written up in the [wiki](https://github.com/nyd-user-1/govblock/wiki).

### Reporting Bugs and Issues

If you think you have found a bug, [open an issue](https://github.com/nyd-user-1/govblock/issues/new). Include the page you were on, the jurisdiction in the header, and what you expected to see. The URL carries the scope, so paste it whole. A screenshot helps.

### Reporting Security Issues and Responsible Disclosure

We appreciate responsible disclosure of anything that might affect the integrity of the site or of a reader's connected accounts. Please do not open a public issue for a security problem. Report it privately through the repository's [security page](https://github.com/nyd-user-1/govblock/security), and we will respond there.

### Contributing

GovBlock is early and the record is large. Contributions are welcome: a jurisdiction whose rows read wrong, a page that could say more, a connector you use, an agent that should exist.

1. Fork the repository, clone it, and run `pnpm install` and `pnpm dev`.
2. Make your change on a branch. Run `pnpm typecheck` and `pnpm lint` before you push.
3. Write the commit as `area: what changed, in a sentence`. For example, `search: aliases, so 'holmes' finds Eleanor Holmes Norton`. The changelog page is built from these subjects, so each one is a release note.
4. Open a pull request and say what a reader will see differently.

By opening a pull request you agree that your contribution is licensed under the same terms as the repository.

### License

Copyright © 2026 Brendan Stanton.

The code in this repository is licensed under the [GNU Affero General Public License v3.0](LICENSE). Use it, change it and run it, commercially or not. If you run a modified version as a service, publish your changes under the same license.

The data GovBlock publishes is licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Forks and commits you make on GovBlock are contributed under the same terms.

The GovBlock name and mark are not covered by either license.
