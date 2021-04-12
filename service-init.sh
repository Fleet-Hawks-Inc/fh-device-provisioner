
systemctl enable mqtt
systemctl enable greengrass
cp certs/** /greengrass/certs/
cp config/** /greengrass/config/
systemctl start mqtt
systemctl start greegrass