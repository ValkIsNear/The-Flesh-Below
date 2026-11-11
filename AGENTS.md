<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Reuse DiveScene for both outbound and return exploration, with direction-dependent spawn and encounter handling; this keeps the tunnel geometry and textures identical in both visits.
- Keep return-growth eligibility and projected eye hit rules in tunnel-flow and test them independently; rendering and firing must use the same eye positions and sizes.
- Reuse DiveScene's renderer in an isolated comms mode for post-credits walking; pause input without rebuilding the level during dialogue to preserve player position.
- Keep post-credits conversation branches and Dive Log event rules in a browser-safe pure module with tests; Game owns session log state, and dialogue choices must converge before advancing.
- Start comms reception from terminal proximity and keep entry, options, branches, and shared ending in the conversation flow module; this preserves walking while preventing divergent scene endings.
- Validate invisible scene search entries in the browser-safe dev-scenes module; reuse existing scenes and normal post-morgue state, and show an explicit developer-only unavailable view for scenes not yet built rather than inventing narrative.
