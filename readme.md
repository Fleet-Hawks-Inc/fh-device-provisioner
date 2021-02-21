## Automatic Green Grass Device Provisioner

## Pre-requisite 
AWS Access keys from AWS console

## Command line options 

```
kunaldeshmukh@Kunals-MacBook-Air fh-device-provisioner % node provisionCore.js --help
Usage: provisionCore [options]

******FleetHawks - GreenGrass Provisioner : Provisions MiniEld with FleetHawks Cloud******

Options:
  -c, --coreName <coreName>                 Mini Eld Core Name
  -a, --accessKey <accessKey>               AWS Access Key ID
  -s, --secretAccessKey <secretAccessKey>s  AWS Secret Access Key (Required)
  -r, --region                              AWS region where to deploy. (default: "us-east-2")
  -d, --debug                               Print stack strace
  -h, --help                                display help for command
```

### Example 

```
node provisionCore.js -c SampleGroup -a AWS_ACCESS_KEY_ID -s AWS_SECRET_ACCESS_KEY -r us-east-2
```