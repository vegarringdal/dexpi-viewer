# Blueprint files and DiscProfile version

The blueprint files in this folder (`DISC_EXAMPLE-14/*.xml` and the matching `*.svg` /
PDF renderings) were produced against **DiscProfile 0.6.3**
(`Profile/xml0.6.3/DiscProfile.xml`).

## Known incompatibility with DiscProfile 0.6.4

In DiscProfile 0.6.4 (`Profile/xml/DiscProfile.xml`) the mapping of symbol
**ND0035** was changed to **ProcessInstrumentationFunction**. The blueprint files
still carry the 0.6.3 mapping for ND0035, so validating them against 0.6.4 will fail
with a validation error on the ND0035 element.

This is expected. The files are not wrong for the profile they were made with;
they simply predate the 0.6.4 mapping change (see
`DiscProfile_Changes_0.6.3_to_0.6.4.md` in the repo root).

## Use as a test case

This mismatch is a useful test of how the profile extension mechanism works:

- Validate against 0.6.3 → the files pass.
- Validate against 0.6.4 → ND0035 is reported as invalid.

Use it to confirm that a validator picks up the profile version actually in use and
that a mapping change in the profile is reflected as a validation error in existing
files, rather than being silently accepted.

To bring the blueprints in line with 0.6.4, the ND0035 elements need to be remapped
to ProcessInstrumentationFunction.
