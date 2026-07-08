-- CHM Office Hours (Zoom Meeting): admin approval before join, same as LIVE webinars
UPDATE "Program" SET "registrationRequiresApproval" = true WHERE "zoomSessionType" = 'MEETING';
